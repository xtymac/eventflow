// P1修复: 移除所有图标导入,极简设计无需图标

/**
 * Type-safe mapping from string keys to mapStore toggle functions
 */
export type MapToggleActions = {
  toggleGreenSpaces: () => void;
  toggleParkFacilities: () => void;
  toggleParkTrees: () => void;
  toggleStreetTrees: () => void;
  toggleInspections: () => void;
  toggleEvents: () => void;
  toggleNagoyaBuildingZones: () => void;
  toggleNagoyaRoads: () => void;
};

/**
 * Data layer configuration for hierarchical navigation menu
 * P1修复: 移除icon字段,极简扁平设计无需图标
 */
export interface DataLayer {
  /** Unique identifier for the layer */
  id: string;
  /** Display label (Japanese) */
  label: string;
  // ❌ P1删除: icon?: React.ComponentType<{ size?: number | string }>;
  /** Toggle key (maps to mapStore toggle function) */
  toggleKey?: keyof MapToggleActions;
  /** Child layers (for hierarchical structure) */
  children?: DataLayer[];
  /** If true, layer is disabled and shown as "coming soon" */
  isPlaceholder?: boolean;
}

/**
 * Business Display (業務表示) layers
 *
 * P1修复: 移除所有icon字段,极简扁平设计无需图标
 */
export const BUSINESS_DISPLAY_LAYERS: DataLayer = {
  id: 'business',
  label: '業務表示',
  children: [
    {
      id: 'parks',
      label: '公園',
      children: [
        {
          id: 'park-areas',
          label: '公園範囲',
          toggleKey: 'toggleGreenSpaces',
        },
        {
          id: 'park-facilities',
          label: '遊具等施設',
          toggleKey: 'toggleParkFacilities',
        },
        {
          id: 'park-trees',
          label: '公園樹',
          toggleKey: 'toggleParkTrees',
          isPlaceholder: true, // No backend data yet
        },
      ],
    },
    {
      id: 'trees',
      label: '樹木',
      children: [
        {
          id: 'street-trees',
          label: '街路樹',
          toggleKey: 'toggleStreetTrees',
        },
      ],
    },
    {
      id: 'inspections',
      label: '点検',
      toggleKey: 'toggleInspections',
    },
    {
      id: 'construction',
      label: '工事',
      toggleKey: 'toggleEvents',
    },
  ],
};

/**
 * Data Display (データ表示) layers
 *
 * P1修复: 移除所有icon字段,极简扁平设计无需图标
 */
export const DATA_DISPLAY_LAYERS: DataLayer = {
  id: 'data',
  label: 'データ表示',
  children: [
    {
      id: 'land-use',
      label: '用途地域',
      toggleKey: 'toggleNagoyaBuildingZones',
    },
    {
      id: 'construction-info',
      label: '建設情報',
      isPlaceholder: true, // To be implemented later
    },
    {
      id: 'designated-roads',
      label: '指定道路',
      toggleKey: 'toggleNagoyaRoads',
    },
  ],
};
