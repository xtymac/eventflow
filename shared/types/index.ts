import type { Feature, Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection } from 'geojson';

// Event status lifecycle
export type EventStatus = 'planned' | 'active' | 'pending_review' | 'closed' | 'archived' | 'cancelled';

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

// River geometry type (line = centerline, polygon = water body, collection = complex OSM relation)
export type RiverGeometryType = 'line' | 'polygon' | 'collection';

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
  // Phase 1: Close tracking fields
  closedBy?: string;
  closedAt?: string | null;         // ISO 8601 timestamp
  closeNotes?: string | null;
  // Populated from JOINs (Phase 1)
  workOrders?: WorkOrder[];
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
  osmId?: string;             // String to avoid JS 2^53 overflow for large OSM IDs
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

// Inspection Record entity (LEGACY - use WorkOrder with type='inspection' for new inspections)
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

// ============================================
// Phase 1: WorkOrder / Evidence Types
// ============================================

// Work order types
export type WorkOrderType = 'inspection' | 'repair' | 'update';

// Work order status lifecycle
export type WorkOrderStatus = 'draft' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

// Evidence types
export type EvidenceType = 'photo' | 'document' | 'report' | 'cad' | 'other';

// Evidence review status
export type EvidenceReviewStatus = 'pending' | 'approved' | 'rejected';

// Partner roles in work orders
export type PartnerRole = 'contractor' | 'inspector' | 'reviewer';

// Work Order entity
export interface WorkOrder {
  id: string;
  eventId: string;
  type: WorkOrderType;
  title: string;
  description?: string;
  status: WorkOrderStatus;
  assignedDept?: string;
  assignedBy?: string;
  assignedAt?: string;      // ISO 8601 timestamp
  dueDate?: string;         // ISO 8601 timestamp
  startedAt?: string;       // ISO 8601 timestamp
  completedAt?: string;     // ISO 8601 timestamp
  reviewedBy?: string;
  reviewedAt?: string;      // ISO 8601 timestamp
  reviewNotes?: string;
  createdBy?: string;
  createdAt: string;        // ISO 8601 timestamp
  updatedAt: string;        // ISO 8601 timestamp
  // Populated from JOINs
  locations?: WorkOrderLocation[];
  partners?: WorkOrderPartner[];
  evidence?: Evidence[];
}

// Work Order Location - points/areas associated with work order
export interface WorkOrderLocation {
  id: string;
  workOrderId: string;
  geometry: SupportedGeometry;
  assetType?: string;       // 'road' | 'greenspace' | 'streetlight' | null
  assetId?: string;         // Reference to the specific asset
  note?: string;
  sequenceOrder: number;
  createdAt: string;        // ISO 8601 timestamp
}

// Work Order Partner - contractors/partners assigned
export interface WorkOrderPartner {
  workOrderId: string;
  partnerId: string;
  partnerName: string;
  role: PartnerRole;
  assignedAt: string;       // ISO 8601 timestamp
}

// Evidence - photos, documents attached to work orders
export interface Evidence {
  id: string;
  workOrderId: string;
  type: EvidenceType;
  fileName: string;
  filePath: string;
  fileSizeBytes?: number;
  mimeType?: string;
  title?: string;
  description?: string;
  captureDate?: string;     // ISO 8601 timestamp
  geometry?: Point;         // Geotagged location
  submittedBy: string;
  submittedAt: string;      // ISO 8601 timestamp
  reviewedBy?: string;
  reviewedAt?: string;      // ISO 8601 timestamp
  reviewStatus: EvidenceReviewStatus;
  reviewNotes?: string;
}

// GeoJSON Feature types for map rendering
export type ConstructionEventFeature = Feature<SupportedGeometry, ConstructionEvent>;
export type RoadAssetFeature = Feature<SupportedGeometry, RoadAsset>;
export type InspectionFeature = Feature<Point, InspectionRecord>;

// NEW: Feature types for new asset types
export type RiverAssetFeature = Feature<SupportedGeometry, RiverAsset>;
export type GreenSpaceAssetFeature = Feature<Polygon, GreenSpaceAsset>;
export type StreetLightAssetFeature = Feature<Point, StreetLightAsset>;

// Phase 1: WorkOrder location feature for map display
export type WorkOrderLocationFeature = Feature<SupportedGeometry, WorkOrderLocation & { workOrder: Partial<WorkOrder> }>;

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
  status: 'active' | 'pending_review';
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

// ============================================
// Phase 1: WorkOrder / Evidence API Types
// ============================================

// Create work order request
export interface CreateWorkOrderRequest {
  eventId: string;            // Required - WorkOrder must belong to an Event
  type: WorkOrderType;
  title: string;
  description?: string;
  assignedDept?: string;
  dueDate?: string;           // ISO 8601 timestamp
}

// Update work order request
export interface UpdateWorkOrderRequest {
  title?: string;
  description?: string;
  assignedDept?: string;
  dueDate?: string;
  reviewNotes?: string;
}

// Work order status change
export interface WorkOrderStatusChangeRequest {
  status: WorkOrderStatus;
}

// Work order assignment
export interface AssignWorkOrderRequest {
  assignedDept: string;
  assignedBy?: string;
}

// Add location to work order
export interface AddWorkOrderLocationRequest {
  geometry: SupportedGeometry;
  assetType?: string;
  assetId?: string;
  note?: string;
  sequenceOrder?: number;
}

// Add partner to work order
export interface AddWorkOrderPartnerRequest {
  partnerId: string;
  partnerName: string;
  role?: PartnerRole;
}

// Upload evidence (multipart - actual file upload handled separately)
export interface CreateEvidenceRequest {
  type: EvidenceType;
  title?: string;
  description?: string;
  captureDate?: string;
  geometry?: Point;           // Geotagged location
}

// Review evidence
export interface ReviewEvidenceRequest {
  reviewStatus: 'approved' | 'rejected';
  reviewNotes?: string;
}

// Event status change (updated for Phase 1)
export interface EventStatusChangeRequest {
  status: 'active' | 'pending_review';  // Phase 1: use /close endpoint for closing
}

// Event close request (Phase 1 - Gov only)
export interface CloseEventRequest {
  closeNotes?: string;
}

// Work order filters for list endpoint
export interface WorkOrderFilters {
  eventId?: string;
  status?: WorkOrderStatus | WorkOrderStatus[];
  type?: WorkOrderType | WorkOrderType[];
  assignedDept?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  limit?: number;
  offset?: number;
}

// Evidence filters
export interface EvidenceFilters {
  workOrderId?: string;
  type?: EvidenceType | EvidenceType[];
  reviewStatus?: EvidenceReviewStatus | EvidenceReviewStatus[];
  limit?: number;
  offset?: number;
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

// ============================================
// Search Types (Map Navigation Search)
// ============================================

// Search result types (map navigation + local assets)
export type SearchResultType =
  | 'place'
  | 'coordinate'
  | 'event'
  | 'road'
  | 'greenspace'
  | 'streetlight'
  | 'river';

// Unified search result format
export interface SearchResult {
  id: string; // Unique result ID (may include type prefix)
  type: SearchResultType;
  name: string;
  subtitle?: string;
  coordinates?: [number, number]; // [lng, lat] for point results
  geometry?: SupportedGeometry; // Optional geometry for fly-to
  sourceId?: string; // Raw entity ID (event/asset/etc.)
  metadata?: Record<string, unknown>;
}

// Search API response (unified)
export interface SearchResponse {
  data: {
    results: SearchResult[];
    searchCenter?: [number, number]; // [lng, lat] for coordinate search
    isCoordinateSearch: boolean;
  };
  meta: {
    query: string;
    processingTime: number;
    error?: string;
    errorMessage?: string;
  };
}
