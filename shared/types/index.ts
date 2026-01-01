import type { Feature, Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection } from 'geojson';

// Event status lifecycle
export type EventStatus = 'planned' | 'active' | 'ended';

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
export type NameSource = 'osm' | 'municipal' | 'manual';

// Name match confidence level
export type NameConfidence = 'high' | 'medium' | 'low';

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
  roadAssets?: RoadAsset[]; // Populated from JOIN query, replaces affectedRoadAssetIds
  department: string;
  ward?: string;
  createdBy?: string;
  updatedAt: string; // ISO 8601 timestamp
}

// Road Asset entity
export interface RoadAsset {
  id: string;
  name?: string;          // Raw OSM name (null for unnamed roads, no placeholder)
  nameJa?: string;        // Japanese name from OSM (name:ja tag)
  ref?: string;           // Route reference (e.g., 国道23号)
  localRef?: string;      // Local reference code
  displayName?: string;   // Computed fallback: name || nameJa || ref || localRef
  nameSource?: NameSource;      // Source of name: osm, municipal, manual
  nameConfidence?: NameConfidence; // Match confidence: high, medium, low
  geometry: SupportedGeometry;
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
  updatedAt: string; // ISO 8601 timestamp
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
}

export interface AssetFilters {
  status?: AssetStatus;
  roadType?: RoadType | RoadType[];
  ownerDepartment?: string;
  ward?: string;
  // Pagination and search fields
  q?: string;                  // Text search (name, ID, or ward)
  bbox?: string;               // "minLng,minLat,maxLng,maxLat"
  limit?: number;              // Default 200, max 1000
  offset?: number;             // For pagination
  includeTotal?: boolean;      // Skip COUNT query if false
  unnamed?: boolean;           // Filter unnamed roads only
  filterByMapView?: boolean;   // Toggle for map view filter (UI-only, not sent to API)
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
