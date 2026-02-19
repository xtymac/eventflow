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
  const hasChildren = layer.children && layer.children.length > 0;

  const checkmark = isActive ? (
    <span style={{ color: '#2e7d32', fontSize: 12, marginLeft: 'auto', fontWeight: 700 }}>&#10003;</span>
  ) : null;

  if (hasChildren) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: `calc(100% - ${depth * 20 + 12}px)`,
          marginLeft: depth * 20 + 12,
          marginBottom: 4,
          padding: '8px 12px',
          backgroundColor: '#f1f3f5',
          borderRadius: 2,
          fontSize: 14,
          fontWeight: 600,
          color: '#333',
        }}
      >
        {layer.label}
        {checkmark}
      </div>
    );
  }

  const button = (
    <button
      type="button"
      onClick={layer.isPlaceholder ? undefined : onToggle}
      disabled={layer.isPlaceholder}
      tabIndex={layer.isPlaceholder ? -1 : 0}
      aria-disabled={layer.isPlaceholder}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: `calc(100% - ${depth * 20 + 12}px)`,
        marginLeft: depth * 20 + 12,
        marginBottom: 4,
        padding: '8px 12px',
        backgroundColor: '#f1f3f5',
        color: layer.isPlaceholder ? '#adb5bd' : '#333',
        border: 'none',
        borderRadius: 2,
        fontSize: 14,
        textAlign: 'left',
        cursor: layer.isPlaceholder ? 'not-allowed' : 'pointer',
        opacity: layer.isPlaceholder ? 0.6 : 1,
      }}
    >
      {layer.label}
      {!layer.isPlaceholder && checkmark}
    </button>
  );

  if (layer.isPlaceholder) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent side="right">
          データ準備中
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
