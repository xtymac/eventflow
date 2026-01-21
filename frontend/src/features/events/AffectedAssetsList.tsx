import { Stack, Text, Group, UnstyledButton, Badge } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { getRoadAssetLabel } from '../../utils/roadAssetLabel';
import type { RoadAsset } from '@nagoya/shared';

const ROAD_TYPE_COLORS: Record<string, string> = {
  arterial: 'violet',
  collector: 'cyan',
  local: 'lime',
};

interface AffectedAssetsListProps {
  assets: RoadAsset[];
}

export function AffectedAssetsList({ assets }: AffectedAssetsListProps) {
  const { selectAsset, setCurrentView } = useUIStore();

  const handleAssetClick = (assetId: string) => {
    selectAsset(assetId);
    setCurrentView('assets');
  };

  return (
    <Stack gap={4}>
      <Text size="xs" fw={500} c="dimmed">
        Affected Road Assets ({assets.length})
      </Text>

      {assets.map((asset) => (
        <UnstyledButton
          key={asset.id}
          onClick={() => handleAssetClick(asset.id)}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--mantine-color-gray-1)',
          }}
          styles={{
            root: {
              '&:hover': {
                backgroundColor: 'var(--mantine-color-blue-0)',
              },
            },
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden' }}>
              <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                {getRoadAssetLabel(asset)}
              </Text>
              {asset.roadType && (
                <Badge
                  size="xs"
                  variant="light"
                  color={ROAD_TYPE_COLORS[asset.roadType] || 'gray'}
                >
                  {asset.roadType}
                </Badge>
              )}
            </Group>
            <IconChevronRight size={12} color="var(--mantine-color-gray-5)" />
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );
}
