import { Stack, Text } from '@/components/shims';
import { useMapStore } from '../../stores/mapStore';
import { LayerMenuItem } from './LayerMenuItem';
import {
  BUSINESS_DISPLAY_LAYERS,
  DATA_DISPLAY_LAYERS,
  type DataLayer,
  type MapToggleActions,
} from './adminDataLayers';

/** Map toggleKey -> show* state key */
const TOGGLE_TO_SHOW: Record<keyof MapToggleActions, string> = {
  toggleGreenSpaces: 'showGreenSpaces',
  toggleParkFacilities: 'showParkFacilities',
  toggleParkTrees: 'showParkTrees',
  toggleStreetTrees: 'showStreetTrees',
  toggleInspections: 'showInspections',
  toggleEvents: 'showEvents',
  toggleNagoyaBuildingZones: 'showNagoyaBuildingZones',
  toggleNagoyaRoads: 'showNagoyaRoads',
};

/** Check if a layer (or any of its descendants) is currently visible */
function isLayerActive(layer: DataLayer, visibilityMap: Record<string, boolean>): boolean {
  if (layer.toggleKey) {
    const showKey = TOGGLE_TO_SHOW[layer.toggleKey];
    if (showKey && visibilityMap[showKey]) return true;
  }
  if (layer.children) {
    return layer.children.some((child) => isLayerActive(child, visibilityMap));
  }
  return false;
}

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

  const visibilityMap: Record<string, boolean> = {
    showGreenSpaces: mapStore.showGreenSpaces,
    showParkFacilities: mapStore.showParkFacilities,
    showParkTrees: mapStore.showParkTrees,
    showStreetTrees: mapStore.showStreetTrees,
    showInspections: mapStore.showInspections,
    showEvents: mapStore.showEvents,
    showNagoyaBuildingZones: mapStore.showNagoyaBuildingZones,
    showNagoyaRoads: mapStore.showNagoyaRoads,
  };

  const renderLayer = (layer: DataLayer, depth: number = 0): JSX.Element[] => {
    const active = isLayerActive(layer, visibilityMap);

    const result: JSX.Element[] = [
      <LayerMenuItem
        key={layer.id}
        layer={layer}
        onToggle={layer.toggleKey ? toggleActions[layer.toggleKey] : undefined}
        depth={depth}
        isActive={active}
      />,
    ];

    if (layer.children && layer.children.length > 0) {
      layer.children.forEach((child) => {
        result.push(...renderLayer(child, depth + 1));
      });
    }

    return result;
  };

  return (
    <Stack gap="0" mt="sm">
      <div style={{ paddingLeft: 8, marginBottom: 8, marginLeft: 4 }}>
        <Text size="sm" fw={700}>{BUSINESS_DISPLAY_LAYERS.label}</Text>
      </div>
      {BUSINESS_DISPLAY_LAYERS.children?.map((child) => renderLayer(child))}

      <div style={{ height: 16 }} />

      <div style={{ paddingLeft: 8, marginBottom: 8, marginLeft: 4 }}>
        <Text size="sm" fw={700}>{DATA_DISPLAY_LAYERS.label}</Text>
      </div>
      {DATA_DISPLAY_LAYERS.children?.map((child) => renderLayer(child))}
    </Stack>
  );
}
