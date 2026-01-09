import type { Feature, Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection } from 'geojson';

// Event status lifecycle
export type EventStatus = 'planned' | 'active' | 'ended' | 'cancelled';

// Restriction types for construction events
export type RestrictionType = 'full' | 'partial' | 'workzone';

// Post-end decision options
export type PostEndDecision = 'pending' | 'no-change' | 'permanent-change';

// Road asset status
export type AssetStatus = 'active' | 'inactive';

// Road types
export type RoadType = 'arterial' | 'collector' | 'local';

// Road asset change types
export type ChangeType = 'create' | 'update' | 'retire';

// Event-Asset relation types
export type RelationType = 'affected' | 'updated';

// Geometry source (manual draw vs auto-generated)
export type GeometrySource = 'manual' | 'auto';

// Name source for traceability
export type NameSource = 'osm' | 'municipal' | 'manual' | 'google';

// Name match confidence level
export type NameConfidence = 'high' | 'medium' | 'low';

// ============================================
// NEW: Data Source Types
// ============================================

// Data source for all asset types
export type DataSource = 'osm_test' | 'official_ledger' | 'manual';

// OSM element types
export type OsmType = 'node' | 'way' | 'relation';

// ============================================
// NEW: River Asset Types
// ============================================

// River geometry type (line = centerline, polygon = water body)
export type RiverGeometryType = 'line' | 'polygon';

// Waterway types from OSM
export type WaterwayType = 'river' | 'stream' | 'canal' | 'drain';

// Water body types from OSM (for polygon rivers)
export type WaterType = 'river' | 'pond' | 'lake';

// Management level for rivers
export type ManagementLevel = 'national' | 'prefectural' | 'municipal';

// ============================================
// NEW: Green Space Asset Types
// ============================================

// Green space classification
export type GreenSpaceType = 'park' | 'garden' | 'grass' | 'forest' | 'meadow' | 'playground';

// Vegetation types
export type VegetationType = 'trees' | 'grass' | 'mixed' | 'flower_beds' | 'shrubs';

// ============================================
// NEW: Street Light Asset Types
// ============================================

// Light bulb types
export type LampType = 'led' | 'sodium' | 'mercury' | 'fluorescent' | 'halogen';

// Equipment operational status (different from data lifecycle status)
export type LampStatus = 'operational' | 'maintenance' | 'damaged' | 'replaced';

// Supported geometry types
export type SupportedGeometry =
  | Point
  | LineString
  | Polygon
  | MultiPoint
  | MultiLineString
  | MultiPolygon
  | GeometryCollection;

// UI-editable geometry types
export type EditableGeometry = Point | LineString | Polygon;

// Construction Event entity
export interface ConstructionEvent {
  id: string;
  name: string;
  status: EventStatus;
  startDate: string; // ISO 8601 timestamp
  endDate: string; // ISO 8601 timestamp
  restrictionType: RestrictionType;
  geometry: SupportedGeometry;
  geometrySource?: GeometrySource; // 'manual' | 'auto'
  postEndDecision: PostEndDecision;
  archivedAt?: string | null; // ISO 8601 timestamp, null = not archived
  roadAssets?: RoadAsset[]; // Populated from JOIN query, replaces affectedRoadAssetIds
  department: string;
  ward?: string;
  createdBy?: string;
  updatedAt: string; // ISO 8601 timestamp
}

// Common data source tracking fields (shared across all asset types)
export interface DataSourceTracking {
  dataSource?: DataSource;
  sourceVersion?: string;
  sourceDate?: string;        // ISO 8601 timestamp
  lastVerifiedAt?: string;    // ISO 8601 timestamp
}

// Common OSM tracking fields
export interface OsmTracking {
  osmType?: OsmType;
  osmId?: number;
  osmTimestamp?: string;      // ISO 8601 timestamp
  lastSyncedAt?: string;      // ISO 8601 timestamp
  isManuallyEdited?: boolean;
}

// Road Asset entity (updated with new fields)
export interface RoadAsset extends DataSourceTracking, OsmTracking {
  id: string;
  name?: string;          // Raw OSM name (null for unnamed roads, no placeholder)
  nameJa?: string;        // Japanese name from OSM (name:ja tag)
  ref?: string;           // Route reference (e.g., 国道23号)
  localRef?: string;      // Local reference code
  displayName?: string;   // Computed fallback: name || nameJa || ref || localRef
  nameSource?: NameSource;      // Source of name: osm, municipal, manual
  nameConfidence?: NameConfidence; // Match confidence: high, medium, low
  geometry: SupportedGeometry;  // LineString (legacy) or Polygon (new)
  roadType: RoadType;
  lanes: number;
  direction: string;
  status: AssetStatus;
  validFrom: string; // ISO 8601 timestamp
  validTo?: string; // ISO 8601 timestamp
  replacedBy?: string; // ID of replacement asset
  ownerDepartment?: string;
  ward?: string;
  landmark?: string;
  sublocality?: string;  // 町名/丁目 from Google Maps
  // NEW: Road polygon-specific fields
  crossSection?: string;
  managingDept?: string;
  intersection?: string;
  pavementState?: string;
  updatedAt: string; // ISO 8601 timestamp
}

// ============================================
// NEW: River Asset Entity
// ============================================
export interface RiverAsset extends DataSourceTracking, OsmTracking {
  id: string;
  name?: string;
  nameJa?: string;
  displayName?: string;
  geometry: SupportedGeometry;  // LineString or Polygon
  geometryType: RiverGeometryType;
  waterwayType?: WaterwayType;
  waterType?: WaterType;
  width?: number;             // meters
  managementLevel?: ManagementLevel;
  maintainer?: string;
  status: AssetStatus;
  ward?: string;
  updatedAt: string;
}

// ============================================
// NEW: Green Space Asset Entity
// ============================================
export interface GreenSpaceAsset extends DataSourceTracking, OsmTracking {
  id: string;
  name?: string;
  nameJa?: string;
  displayName?: string;
  geometry: Polygon;
  greenSpaceType: GreenSpaceType;
  leisureType?: string;       // OSM leisure tag
  landuseType?: string;       // OSM landuse tag
  naturalType?: string;       // OSM natural tag
  areaM2?: number;            // Area in square meters
  vegetationType?: VegetationType;
  operator?: string;          // Operating organization
  status: AssetStatus;
  ward?: string;
  updatedAt: string;
}

// ============================================
// NEW: Street Light Asset Entity
// ============================================
export interface StreetLightAsset extends DataSourceTracking, OsmTracking {
  id: string;
  lampId?: string;            // Physical identification number
  displayName?: string;
  geometry: Point;
  lampType: LampType;
  wattage?: number;           // watts
  installDate?: string;       // ISO 8601 timestamp
  lampStatus: LampStatus;     // Equipment status
  roadRef?: string;           // Reference to road_assets.id
  status: AssetStatus;        // Data lifecycle status
  ward?: string;
  updatedAt: string;
}

// Road Asset Change record (for traceability)
export interface RoadAssetChange {
  id: string;
  eventId: string;
  changeType: ChangeType;
  oldRoadAssetId?: string;
  newRoadAssetId?: string;
  geometry?: SupportedGeometry;
  createdAt: string; // ISO 8601 timestamp
}

// Inspection Record entity
// Exactly one of eventId or roadAssetId must be set
export interface InspectionRecord {
  id: string;
  eventId: string | null; // FK to construction_events
  roadAssetId: string | null; // FK to road_assets
  inspectionDate: string; // ISO 8601 date
  result: string;
  notes?: string;
  geometry: Point;
  createdAt: string; // ISO 8601 timestamp
}

// GeoJSON Feature types for map rendering
export type ConstructionEventFeature = Feature<SupportedGeometry, ConstructionEvent>;
export type RoadAssetFeature = Feature<SupportedGeometry, RoadAsset>;
export type InspectionFeature = Feature<Point, InspectionRecord>;

// NEW: Feature types for new asset types
export type RiverAssetFeature = Feature<SupportedGeometry, RiverAsset>;
export type GreenSpaceAssetFeature = Feature<Polygon, GreenSpaceAsset>;
export type StreetLightAssetFeature = Feature<Point, StreetLightAsset>;

// API request/response types
export interface CreateEventRequest {
  name: string;
  startDate: string;
  endDate: string;
  restrictionType: RestrictionType;
  geometry?: SupportedGeometry; // Optional - auto-generate from road assets if not provided
  department: string;
  ward?: string;
  roadAssetIds: string[]; // Required - at least 1 road asset
}

export interface UpdateEventRequest {
  name?: string;
  startDate?: string;
  endDate?: string;
  restrictionType?: RestrictionType;
  geometry?: SupportedGeometry;
  department?: string;
  ward?: string;
  roadAssetIds?: string[];
  regenerateGeometry?: boolean; // Explicit flag to regenerate from roads
}

export interface StatusChangeRequest {
  status: 'active' | 'ended';
}

export interface PostEndDecisionRequest {
  decision: 'no-change' | 'permanent-change';
}

export interface CreateAssetRequest {
  name?: string;
  nameJa?: string;
  ref?: string;
  localRef?: string;
  geometry: SupportedGeometry;
  roadType: RoadType;
  lanes: number;
  direction: string;
  ownerDepartment?: string;
  ward?: string;
  eventId?: string; // For traceability - creates RoadAssetChange
}

export interface UpdateAssetRequest extends Partial<Omit<CreateAssetRequest, 'eventId'>> {
  eventId?: string; // For traceability - creates RoadAssetChange
}

export interface RetireAssetRequest {
  eventId: string; // Required for traceability
  replacedBy?: string; // ID of replacement asset
}

// Exactly one of eventId or roadAssetId must be provided
export interface CreateInspectionRequest {
  eventId?: string;
  roadAssetId?: string;
  inspectionDate: string;
  result: string;
  notes?: string;
  geometry: Point;
}

// Filter types for list endpoints
export interface EventFilters {
  status?: EventStatus;
  department?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  name?: string;
  ward?: string;
  includeArchived?: boolean; // false = hide archived, true = include archived
}

export interface AssetFilters {
  status?: AssetStatus;
  roadType?: RoadType | RoadType[];
  ownerDepartment?: string;
  ward?: string;
  dataSource?: DataSource | DataSource[];  // NEW: Filter by data source
  // Pagination and search fields
  q?: string;                  // Text search (name, ID, or ward)
  bbox?: string;               // "minLng,minLat,maxLng,maxLat" - REQUIRED for list endpoints
  limit?: number;              // Default 200, max 1000
  offset?: number;             // For pagination
  includeTotal?: boolean;      // Skip COUNT query if false
  unnamed?: boolean;           // Filter unnamed roads only
  filterByMapView?: boolean;   // Toggle for map view filter (UI-only, not sent to API)
}

// ============================================
// NEW: Filter types for new asset types
// ============================================

export interface RiverFilters {
  status?: AssetStatus;
  waterwayType?: WaterwayType | WaterwayType[];
  geometryType?: RiverGeometryType;
  ward?: string;
  dataSource?: DataSource | DataSource[];
  bbox: string;                // REQUIRED: "minLng,minLat,maxLng,maxLat"
  limit?: number;
  offset?: number;
}

export interface GreenSpaceFilters {
  status?: AssetStatus;
  greenSpaceType?: GreenSpaceType | GreenSpaceType[];
  ward?: string;
  dataSource?: DataSource | DataSource[];
  minArea?: number;            // Filter by minimum area in m²
  bbox: string;                // REQUIRED
  limit?: number;
  offset?: number;
}

export interface StreetLightFilters {
  status?: AssetStatus;
  lampType?: LampType | LampType[];
  lampStatus?: LampStatus | LampStatus[];
  ward?: string;
  dataSource?: DataSource | DataSource[];
  bbox: string;                // REQUIRED
  limit?: number;
  offset?: number;
}

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number | null;  // null when includeTotal=false
    limit?: number;
    offset?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
