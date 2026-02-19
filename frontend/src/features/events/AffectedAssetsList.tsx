import { Stack, Text, Group } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { IconChevronRight } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { getRoadAssetLabel } from '../../utils/roadAssetLabel';
import type { RoadAsset } from '@nagoya/shared';

const ROAD_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  arterial: 'secondary',
  collector: 'secondary',
  local: 'outline',
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
        <button
          key={asset.id}
          onClick={() => handleAssetClick(asset.id)}
          className="w-full text-left px-2 py-1 rounded bg-muted hover:bg-blue-50 transition-colors"
        >
          <Group justify="space-between" className="flex-nowrap">
            <Group gap="xs" className="flex-nowrap overflow-hidden">
              <Text size="xs" lineClamp={1} className="flex-1">
                {getRoadAssetLabel(asset)}
              </Text>
              {asset.roadType && (
                <Badge
                  variant={ROAD_TYPE_VARIANT[asset.roadType] || 'outline'}
                  className="text-[10px]"
                >
                  {asset.roadType}
                </Badge>
              )}
            </Group>
            <IconChevronRight size={12} className="text-muted-foreground" />
          </Group>
        </button>
      ))}
    </Stack>
  );
}
