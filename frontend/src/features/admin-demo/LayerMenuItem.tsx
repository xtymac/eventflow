import { Tooltip } from '@mantine/core';
import type { DataLayer } from './adminDataLayers';

interface LayerMenuItemProps {
  layer: DataLayer;
  onToggle?: () => void;
  depth: number;
  /** Whether this layer (or any child) is currently visible on the map */
  isActive?: boolean;
}

/**
 * Layer menu item — uniform gray box design for all items.
 * Category headers and leaf items share the same visual style;
 * categories use bold text, leaves use normal weight.
 * Placeholder items are dimmed with tooltip "データ準備中".
 */
export function LayerMenuItem({
  layer,
  onToggle,
  depth,
  isActive,
}: LayerMenuItemProps) {
  const hasChildren = layer.children && layer.children.length > 0;

  // Small checkmark indicator for active layers (right-aligned)
  const checkmark = isActive ? (
    <span style={{ color: '#2e7d32', fontSize: 12, marginLeft: 'auto', fontWeight: 700 }}>&#10003;</span>
  ) : null;

  // Category headers: gray box with bold text (公園, 樹木)
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
          backgroundColor: 'var(--mantine-color-gray-1)',
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

  // Leaf items: gray box (same visual style, normal weight)
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
        backgroundColor: 'var(--mantine-color-gray-1)',
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
      <Tooltip label="データ準備中" position="right" withArrow>
        {button}
      </Tooltip>
    );
  }

  return button;
}
