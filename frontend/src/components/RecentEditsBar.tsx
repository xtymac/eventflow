import { useState } from 'react';
import { Paper, Group, Text, ActionIcon, Badge, ScrollArea, Loader, Indicator } from '@mantine/core';
import { IconX, IconRoad } from '@tabler/icons-react';
import { useRecentEdits, useRoadEditSSE, type RecentEdit } from '../hooks/useApi';
import { useUIStore } from '../stores/uiStore';
import type { Geometry } from 'geojson';
import type { RoadAsset } from '@nagoya/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface RecentEditsBarProps {
  visible: boolean;
  onDismiss: () => void;
}

const EDIT_TYPE_COLORS = {
  create: 'green',
  update: 'blue',
  delete: 'red',
} as const;

export function RecentEditsBar({ visible, onDismiss }: RecentEditsBarProps) {
  const { data, isLoading } = useRecentEdits({ limit: 10 });
  const setFlyToGeometry = useUIStore((s) => s.setFlyToGeometry);
  const selectAsset = useUIStore((s) => s.selectAsset);
  const [hasNewEdit, setHasNewEdit] = useState(false);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  // Connect to SSE for real-time updates
  useRoadEditSSE({
    onEdit: () => {
      // Flash indicator when new edit arrives
      setHasNewEdit(true);
      setTimeout(() => setHasNewEdit(false), 3000);
    },
  });

  const edits = data?.data ?? [];
  // Filter out viewed edits
  const unviewedEdits = edits.filter((edit) => !viewedIds.has(edit.id));
  const hasEdits = unviewedEdits.length > 0;

  // Determine if bar should be shown (use CSS to hide, not unmount, to avoid React ref cascade)
  const shouldShow = visible && hasEdits;

  const handleRoadClick = async (edit: RecentEdit) => {
    // Helper to mark as viewed - use setTimeout to break the synchronous render cascade
    // that causes SegmentedControl ref infinite loop
    const markViewed = () => {
      setTimeout(() => {
        setViewedIds((prev) => new Set(prev).add(edit.id));
      }, 0);
    };

    // Helper to create bbox polygon for fallback
    const createBboxGeometry = (): Geometry | null => {
      if (edit.bbox && edit.bbox.length === 4) {
        const [minLng, minLat, maxLng, maxLat] = edit.bbox;
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

    // For deleted roads, use bbox directly (road no longer exists)
    if (edit.editType === 'delete') {
      const bboxGeometry = createBboxGeometry();
      if (bboxGeometry) {
        selectAsset(edit.roadAssetId, bboxGeometry);
        setFlyToGeometry(bboxGeometry, true);
      }
      markViewed();
      return;
    }

    // Fetch the road asset to get its actual geometry
    try {
      const response = await fetch(`${API_BASE}/assets/${edit.roadAssetId}`);
      if (response.ok) {
        const result = await response.json() as { data: RoadAsset };
        const asset = result.data;
        if (asset?.geometry) {
          // Select with actual road geometry for highlighting
          selectAsset(edit.roadAssetId, asset.geometry);
          // Fly to the road
          setFlyToGeometry(asset.geometry, true);
          markViewed();
          return;
        }
      }
    } catch (err) {
      // Fall through to bbox fallback
    }

    // Fallback: use bbox for highlighting and navigation
    const bboxGeometry = createBboxGeometry();
    if (bboxGeometry) {
      selectAsset(edit.roadAssetId, bboxGeometry);
      setFlyToGeometry(bboxGeometry, true);
    }

    markViewed();
  };

  const getDisplayName = (edit: RecentEdit) => {
    return edit.roadDisplayName || edit.roadName || `Road ${edit.roadAssetId}`;
  };

  return (
    <Paper
      shadow="sm"
      radius="md"
      p="xs"
      style={{
        position: 'fixed',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: 'calc(100vw - 850px)',
        minWidth: 300,
        backgroundColor: 'var(--mantine-color-body)',
        // Use CSS to hide instead of unmounting to avoid React ref cascade crash
        display: shouldShow ? undefined : 'none',
      }}
    >
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Indicator color="green" size={8} processing={hasNewEdit} disabled={!hasNewEdit}>
            <IconRoad size={16} />
          </Indicator>
          <Text size="sm" fw={500}>Recent Road Edits</Text>
          {isLoading && <Loader size="xs" />}
        </Group>
        <ActionIcon variant="subtle" size="sm" onClick={onDismiss}>
          <IconX size={14} />
        </ActionIcon>
      </Group>

      <ScrollArea.Autosize mah={120} offsetScrollbars scrollbarSize={6}>
        <Group gap="xs" wrap="wrap">
          {unviewedEdits.map((edit) => {
            const color = EDIT_TYPE_COLORS[edit.editType as keyof typeof EDIT_TYPE_COLORS] || 'gray';

            return (
              <Badge
                key={edit.id}
                variant="light"
                color={color}
                style={{ cursor: 'pointer' }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleRoadClick(edit);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onTouchStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                {getDisplayName(edit)}
              </Badge>
            );
          })}
        </Group>
      </ScrollArea.Autosize>
    </Paper>
  );
}
