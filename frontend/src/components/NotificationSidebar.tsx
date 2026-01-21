import { Drawer, Stack, Group, Text, Badge, Button, ScrollArea, Paper, Loader } from '@mantine/core';
import { IconTrash, IconRoad } from '@tabler/icons-react';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationStore } from '../stores/notificationStore';
import { useUIStore } from '../stores/uiStore';
import type { RecentEdit } from '../hooks/useApi';
import type { RoadAsset } from '@nagoya/shared';
import type { Geometry } from 'geojson';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const EDIT_TYPE_COLORS = {
  create: 'green',
  update: 'blue',
  delete: 'red',
} as const;

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
        selectAsset(edit.roadAssetId, bboxGeometry);
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
          selectAsset(edit.roadAssetId, asset.geometry);
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
      selectAsset(edit.roadAssetId, bboxGeometry);
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
    <Drawer
      opened={isSidebarOpen}
      onClose={closeSidebar}
      position="right"
      title={
        <Group gap="xs">
          <IconRoad size={20} />
          <Text fw={600}>Road Edit Notifications</Text>
          {isLoading && <Loader size="xs" />}
        </Group>
      }
      size="md"
    >
      <Stack gap="sm">
        {unreadEdits.length > 0 && (
          <Button
            variant="light"
            color="gray"
            size="xs"
            leftSection={<IconTrash size={14} />}
            onClick={() => markAllAsViewed(unreadEdits.map((e) => e.id))}
          >
            Clear all
          </Button>
        )}

        <ScrollArea.Autosize mah="calc(100vh - 150px)" offsetScrollbars>
          <Stack gap="xs">
            {unreadEdits.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No new notifications
              </Text>
            ) : (
              unreadEdits.map((edit) => {
                const color = EDIT_TYPE_COLORS[edit.editType as keyof typeof EDIT_TYPE_COLORS] || 'gray';

                return (
                  <Paper
                    key={edit.id}
                    p="sm"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      borderLeftWidth: 3,
                      borderLeftColor: `var(--mantine-color-${color}-6)`,
                    }}
                    onClick={() => void handleRoadClick(edit)}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                        <IconRoad size={16} style={{ flexShrink: 0 }} />
                        <Text
                          size="sm"
                          fw={600}
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {getDisplayName(edit)}
                        </Text>
                      </Group>
                      <Badge size="xs" color={color} variant="light">
                        {getEditTypeLabel(edit.editType)}
                      </Badge>
                    </Group>
                    <Group justify="space-between" mt={4}>
                      <Text size="xs" c="dimmed">
                        {edit.roadWard || 'Unknown ward'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatTime(edit.editedAt)}
                      </Text>
                    </Group>
                  </Paper>
                );
              })
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
    </Drawer>
  );
}
