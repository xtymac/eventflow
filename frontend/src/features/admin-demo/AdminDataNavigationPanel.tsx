import { Stack, Text } from '@mantine/core';
import { useMapStore } from '../../stores/mapStore';
import { LayerMenuItem } from './LayerMenuItem';
import {
  BUSINESS_DISPLAY_LAYERS,
  DATA_DISPLAY_LAYERS,
  type DataLayer,
  type MapToggleActions,
} from './adminDataLayers';

/**
 * Admin navigation panel for demo environment (Phase 2 - screenshot-matching design)
 *
 * Design:
 * - Section headers with thick left border (業務表示, データ表示)
 * - Category labels as plain bold text (公園, 樹木)
 * - Leaf items as white bordered boxes
 * - Always expanded (no collapse/expand)
 */
export function AdminDataNavigationPanel() {
  const mapStore = useMapStore();

  const toggleActions: MapToggleActions = {
    toggleGreenSpaces: mapStore.toggleGreenSpaces,
    toggleParkFacilities: mapStore.toggleParkFacilities,
    toggleParkTrees: mapStore.toggleParkTrees,
    toggleStreetTrees: mapStore.toggleStreetTrees,
    toggleInspections: mapStore.toggleInspections,
    toggleEvents: mapStore.toggleEvents,
    toggleNagoyaBuildingZones: mapStore.toggleNagoyaBuildingZones,
    toggleNagoyaRoads: mapStore.toggleNagoyaRoads,
  };

  /** Recursively render layer and all children (always expanded) */
  const renderLayer = (layer: DataLayer, depth: number = 0): JSX.Element[] => {
    const result: JSX.Element[] = [
      <LayerMenuItem
        key={layer.id}
        layer={layer}
        onToggle={layer.toggleKey ? toggleActions[layer.toggleKey] : undefined}
        depth={depth}
      />,
    ];

    // Always render children (no expand/collapse)
    if (layer.children && layer.children.length > 0) {
      layer.children.forEach((child) => {
        result.push(...renderLayer(child, depth + 1));
      });
    }

    return result;
  };

  return (
    <Stack gap={0} mt="sm">
      {/* 業務表示 Section */}
      <div style={{ paddingLeft: 8, marginBottom: 8, marginLeft: 4 }}>
        <Text size="sm" fw={700}>{BUSINESS_DISPLAY_LAYERS.label}</Text>
      </div>
      {BUSINESS_DISPLAY_LAYERS.children?.map((child) => renderLayer(child))}

      {/* Spacing between sections */}
      <div style={{ height: 16 }} />

      {/* データ表示 Section */}
      <div style={{ paddingLeft: 8, marginBottom: 8, marginLeft: 4 }}>
        <Text size="sm" fw={700}>{DATA_DISPLAY_LAYERS.label}</Text>
      </div>
      {DATA_DISPLAY_LAYERS.children?.map((child) => renderLayer(child))}
    </Stack>
  );
}
