import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DataLayer } from './adminDataLayers';

interface LayerMenuItemProps {
  layer: DataLayer;
  onToggle?: () => void;
  depth: number;
  isActive?: boolean;
}

export function LayerMenuItem({
  layer,
  onToggle,
  depth,
  isActive,
}: LayerMenuItemProps) {
  if (layer.isPlaceholder) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: depth > 0 ? 54 : 0 }}
          >
            <Switch size="sm" checked={false} disabled />
            <span className="text-sm text-black/80 opacity-60">
              {layer.label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          データ準備中
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      className="flex items-center gap-2"
      style={{ paddingLeft: depth > 0 ? 54 : 0 }}
    >
      <Switch
        size="sm"
        checked={!!isActive}
        onCheckedChange={onToggle}
        data-testid={`layer-switch-${layer.id}`}
      />
      <span className="text-sm text-black/80">
        {layer.label}
      </span>
    </div>
  );
}
