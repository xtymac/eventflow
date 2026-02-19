import { Stack, Text, Group, Loader } from '@/components/shims';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconTrash, IconRoad } from '@tabler/icons-react';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationStore } from '../stores/notificationStore';
import { useUIStore } from '../stores/uiStore';
import type { RecentEdit } from '../hooks/useApi';
import type { RoadAsset } from '@nagoya/shared';
import type { Geometry } from 'geojson';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const EDIT_TYPE_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
};

const EDIT_TYPE_BORDER_COLORS: Record<string, string> = {
  create: '#16a34a',
  update: '#2563eb',
  delete: '#dc2626',
};

export function NotificationSidebar() {
  const { edits, isLoading } = useNotifications();
  const isSidebarOpen = useNotificationStore((s) => s.isSidebarOpen);
  const closeSidebar = useNotificationStore((s) => s.closeSidebar);
  const viewedEditIds = useNotificationStore((s) => s.viewedEditIds);
  const markAsViewed = useNotificationStore((s) => s.markAsViewed);
  const markAllAsViewed = useNotificationStore((s) => s.markAllAsViewed);

  const selectAsset = useUIStore((s) => s.selectAsset);
  const setFlyToGeometry = useUIStore((s) => s.setFlyToGeometry);

  // Helper to create bbox polygon for fallback
  const createBboxGeometry = (bbox: number[]): Geometry | null => {
    if (bbox && bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      return {
        type: 'Polygon',
        coordinates: [[
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat],
        ]],
      };
    }
    return null;
  };

  // Click handler - fly to road, select it, mark as read
  const handleRoadClick = async (edit: RecentEdit) => {
    // Helper to mark as viewed (use setTimeout to avoid render cascade)
    const markViewed = () => {
      setTimeout(() => markAsViewed(edit.id), 0);
    };

    // For deleted roads, use bbox directly (road no longer exists)
    if (edit.editType === 'delete') {
      const bboxGeometry = createBboxGeometry(edit.bbox);
      if (bboxGeometry) {
        selectAsset(edit.roadAssetId, null, bboxGeometry);
        setFlyToGeometry(bboxGeometry, true);
      }
      markViewed();
      closeSidebar();
      return;
    }

    // Fetch the road asset to get its actual geometry
    try {
      const response = await fetch(`${API_BASE}/assets/${edit.roadAssetId}`);
      if (response.ok) {
        const result = (await response.json()) as { data: RoadAsset };
        const asset = result.data;
        if (asset?.geometry) {
          // Select with actual road geometry for highlighting
          selectAsset(edit.roadAssetId, null, asset.geometry);
          // Fly to the road
          setFlyToGeometry(asset.geometry, true);
          markViewed();
          closeSidebar();
          return;
        }
      }
    } catch {
      // Fall through to bbox fallback
    }

    // Fallback: use bbox for highlighting and navigation
    const bboxGeometry = createBboxGeometry(edit.bbox);
    if (bboxGeometry) {
      selectAsset(edit.roadAssetId, null, bboxGeometry);
      setFlyToGeometry(bboxGeometry, true);
    }

    markViewed();
    closeSidebar();
  };

  const getDisplayName = (edit: RecentEdit) => {
    return edit.roadDisplayName || edit.roadName || `Road ${edit.roadAssetId}`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getEditTypeLabel = (editType: string) => {
    switch (editType) {
      case 'create':
        return 'Created';
      case 'update':
        return 'Updated';
      case 'delete':
        return 'Deleted';
      default:
        return 'Modified';
    }
  };

  // Only show unread notifications (cleared items are hidden)
  const unreadEdits = edits.filter((e) => !viewedEditIds.includes(e.id));

  return (
    <Sheet open={isSidebarOpen} onOpenChange={(open) => { if (!open) closeSidebar(); }}>
      <SheetContent side="right" className="w-[400px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>
            <Group gap="xs">
              <IconRoad size={20} />
              <span>Road Edit Notifications</span>
              {isLoading && <Loader size="xs" />}
            </Group>
          </SheetTitle>
        </SheetHeader>

        <Stack gap="sm" className="mt-4">
          {unreadEdits.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsViewed(unreadEdits.map((e) => e.id))}
            >
              <IconTrash size={14} className="mr-2" />
              Clear all
            </Button>
          )}

          <ScrollArea className="h-[calc(100vh-150px)]">
            <Stack gap="xs">
              {unreadEdits.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No new notifications
                </p>
              ) : (
                unreadEdits.map((edit) => {
                  const borderColor = EDIT_TYPE_BORDER_COLORS[edit.editType] || '#6b7280';
                  const badgeVariant = EDIT_TYPE_VARIANTS[edit.editType] || 'secondary';

                  return (
                    <div
                      key={edit.id}
                      className="cursor-pointer rounded-md border p-3"
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: borderColor,
                      }}
                      onClick={() => void handleRoadClick(edit)}
                    >
                      <Group justify="space-between" className="flex-nowrap">
                        <Group gap="xs" className="min-w-0 flex-1 flex-nowrap">
                          <IconRoad size={16} className="shrink-0" />
                          <span className="truncate text-sm font-semibold">
                            {getDisplayName(edit)}
                          </span>
                        </Group>
                        <Badge variant={badgeVariant} className="text-xs">
                          {getEditTypeLabel(edit.editType)}
                        </Badge>
                      </Group>
                      <Group justify="space-between" className="mt-1">
                        <Text size="xs" c="dimmed">
                          {edit.roadWard || 'Unknown ward'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatTime(edit.editedAt)}
                        </Text>
                      </Group>
                    </div>
                  );
                })
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </SheetContent>
    </Sheet>
  );
}
