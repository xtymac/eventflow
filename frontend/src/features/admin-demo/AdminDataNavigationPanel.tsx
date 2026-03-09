import { useState, type ComponentProps } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMapStore } from '../../stores/mapStore';
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

/** Check if ALL children of a layer are active */
function areAllChildrenActive(layer: DataLayer, visibilityMap: Record<string, boolean>): boolean {
  if (!layer.children) return false;
  return layer.children.every((child) => {
    if (child.isPlaceholder) return true; // Skip placeholders
    return isLayerActive(child, visibilityMap);
  });
}

function LayerSwitch({
  layer,
  onToggle,
  isActive,
  indent,
}: {
  layer: DataLayer;
  onToggle?: () => void;
  isActive: boolean;
  indent: boolean;
}) {
  if (layer.isPlaceholder) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: indent ? 54 : 0 }}
          >
            <Switch checked={false} disabled />
            <span className="text-sm font-normal leading-5 tracking-normal text-foreground opacity-60">
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
      style={{ paddingLeft: indent ? 54 : 0 }}
    >
      <Switch
        checked={isActive}
        onCheckedChange={onToggle}
        data-testid={`layer-switch-${layer.id}`}
      />
      <span className="text-sm font-normal leading-5 tracking-normal text-foreground">
        {layer.label}
      </span>
    </div>
  );
}

/** Switch that renders an indeterminate visual (green bg + minus line) when partial */
function GroupSwitch({
  groupChecked,
  onToggle,
  ...rest
}: {
  groupChecked: boolean | 'indeterminate';
  onToggle: () => void;
} & Omit<ComponentProps<'button'>, 'onClick'>) {
  if (groupChecked === 'indeterminate') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked="mixed"
        onClick={onToggle}
        className="inline-flex h-[1.15rem] w-8 shrink-0 items-center justify-center rounded-full border-0 bg-primary shadow-xs"
        {...rest}
      >
        <Minus size={12} className="text-primary-foreground" strokeWidth={3} />
      </button>
    );
  }

  return (
    <Switch
      checked={groupChecked === true}
      onCheckedChange={onToggle}
      {...rest}
    />
  );
}

function LayerGroup({
  layer,
  toggleActions,
  visibilityMap,
}: {
  layer: DataLayer;
  toggleActions: MapToggleActions;
  visibilityMap: Record<string, boolean>;
}) {
  const [expanded, setExpanded] = useState(true);
  const someActive = isLayerActive(layer, visibilityMap);
  const allActive = areAllChildrenActive(layer, visibilityMap);

  // For the group-level switch: "intermediate" if some but not all children active
  const groupChecked = allActive ? true : someActive ? 'indeterminate' : false;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex h-[1.15rem] w-5 shrink-0 items-center justify-center appearance-none border-none bg-transparent p-0 text-foreground cursor-pointer outline-none"
          data-testid={`layer-group-toggle-${layer.id}`}
        >
          {expanded ? <Minus size={16} /> : <Plus size={16} />}
        </button>
        <div className="flex flex-1 items-center gap-2">
          <GroupSwitch
            groupChecked={groupChecked}
            onToggle={() => {
              // Toggle all children
              if (layer.children) {
                for (const child of layer.children) {
                  if (child.isPlaceholder) continue;
                  if (child.toggleKey) {
                    const showKey = TOGGLE_TO_SHOW[child.toggleKey];
                    const isVisible = showKey ? visibilityMap[showKey] : false;
                    // If some are on, turn all off. If none are on, turn all on.
                    if (someActive && isVisible) {
                      toggleActions[child.toggleKey]();
                    } else if (!someActive && !isVisible) {
                      toggleActions[child.toggleKey]();
                    }
                  }
                }
              }
            }}
            data-testid={`layer-switch-${layer.id}`}
          />
          <span className="text-sm font-normal leading-5 tracking-normal text-foreground">
            {layer.label}
          </span>
        </div>
      </div>
      {expanded && layer.children && (
        <div className="flex flex-col gap-2">
          {layer.children.map((child) => {
            const active = isLayerActive(child, visibilityMap);
            return (
              <LayerSwitch
                key={child.id}
                layer={child}
                onToggle={child.toggleKey ? toggleActions[child.toggleKey] : undefined}
                isActive={active}
                indent
              />
            );
          })}
        </div>
      )}
    </div>
  );
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

  const renderLayer = (layer: DataLayer) => {
    if (layer.children && layer.children.length > 0) {
      return (
        <LayerGroup
          key={layer.id}
          layer={layer}
          toggleActions={toggleActions}
          visibilityMap={visibilityMap}
        />
      );
    }

    const active = isLayerActive(layer, visibilityMap);
    return (
      <LayerSwitch
        key={layer.id}
        layer={layer}
        onToggle={layer.toggleKey ? toggleActions[layer.toggleKey] : undefined}
        isActive={active}
        indent={false}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4" data-testid="layer-panel">
      {/* Business Display section */}
      <div className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-[1.5px] text-muted-foreground">
          {BUSINESS_DISPLAY_LAYERS.label}
        </p>
        <div className="flex flex-col gap-2">
          {BUSINESS_DISPLAY_LAYERS.children?.map((child) => renderLayer(child))}
        </div>
      </div>

      {/* Data Display section */}
      <div className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-[1.5px] text-muted-foreground">
          {DATA_DISPLAY_LAYERS.label}
        </p>
        <div className="flex flex-col gap-2">
          {DATA_DISPLAY_LAYERS.children?.map((child) => renderLayer(child))}
        </div>
      </div>
    </div>
  );
}
