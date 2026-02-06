import type { Feature, Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection } from 'geojson';

// Event status lifecycle
export type EventStatus = 'planned' | 'active' | 'pending_review' | 'closed' | 'archived' | 'cancelled';

// Restriction types for construction events
export type RestrictionType = 'full' | 'partial' | 'workzone';

// Post-end decision options
export type PostEndDecision = 'pending' | 'no-change' | 'permanent-change';

// Asset lifecycle status (governance-level)
export type AssetStatus = 'active' | 'inactive' | 'removed';

// Asset condition assessment (governance-level, set by Decision)
export type AssetCondition = 'good' | 'attention' | 'bad' | 'unknown';

// Asset risk level (governance-level, set by Decision)
export type AssetRiskLevel = 'low' | 'medium' | 'high';

// Road types
export type RoadType = 'arterial' | 'collector' | 'local';

// Road asset change types
export type ChangeType = 'create' | 'update' | 'retire';

// Event-Asset relation types
export type RelationType = 'affected' | 'updated';

// Asset type identifiers for refAsset (matches backend enum)
export type AssetTypeRef =
  | 'road' | 'river' | 'streetlight' | 'greenspace'
  | 'street_tree' | 'park_facility' | 'pavement_section' | 'pump_station';

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

// ============================================
// NEW: Street Tree Asset Types (RFI: 街路樹)
// ============================================

// Tree species classification
export type TreeCategory = 'deciduous' | 'evergreen' | 'conifer' | 'palmLike' | 'shrub';

// Tree health / vitality status
export type TreeHealthStatus = 'healthy' | 'declining' | 'hazardous' | 'dead' | 'removed';

// ============================================
// NEW: Condition Grade (shared across asset types)
// ============================================

// Facility/asset condition grade (劣化度)
export type ConditionGrade = 'A' | 'B' | 'C' | 'D' | 'S';

// ============================================
// NEW: Park Facility Types (RFI: 公園施設)
// ============================================

// Park facility type classification
export type ParkFacilityCategory =
  | 'toilet' | 'playground' | 'bench' | 'shelter' | 'fence' | 'gate'
  | 'drainage' | 'lighting' | 'waterFountain' | 'signBoard' | 'pavement'
  | 'sportsFacility' | 'building' | 'other';

// ============================================
// NEW: Pavement Types (RFI: 舗装維持)
// ============================================

// Pavement surface type
export type PavementType = 'asphalt' | 'concrete' | 'interlocking' | 'gravel' | 'other';

// ============================================
// NEW: Pump Station Types (RFI: ポンプ施設)
// ============================================

// Pump station type classification
export type PumpStationCategory = 'stormwater' | 'sewage' | 'irrigation' | 'combined';

// Pump equipment status
export type PumpEquipmentStatus = 'operational' | 'standby' | 'underMaintenance' | 'outOfService';

// ============================================
// NEW: Inspection Types (RFI: 点検・診断 expanded)
// ============================================

// Inspection type classification
export type InspectionType = 'routine' | 'detailed' | 'emergency' | 'diagnostic';

// Inspection result summary
export type InspectionResult = 'pass' | 'minor' | 'needsRepair' | 'critical';

// ============================================
// NEW: Lifecycle Plan Types (RFI: 長寿命化計画)
// ============================================

// Lifecycle plan status
export type LifecyclePlanStatus = 'draft' | 'approved' | 'active' | 'archived';

// Lifecycle plan intervention type
export type InterventionType = 'repair' | 'renewal' | 'replacement' | 'removal';

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
  // Reference to a related asset (singular)
  refAssetId?: string | null;
  refAssetType?: AssetTypeRef | null;
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
  condition?: AssetCondition;
  riskLevel?: AssetRiskLevel;
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
  condition?: AssetCondition;
  riskLevel?: AssetRiskLevel;
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
  condition?: AssetCondition;
  riskLevel?: AssetRiskLevel;
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
  condition?: AssetCondition;
  riskLevel?: AssetRiskLevel;
  ward?: string;
  updatedAt: string;
}

// ============================================
// NEW: Street Tree Asset Entity (RFI: 街路樹維持管理台帳)
// ============================================
export interface StreetTreeAsset extends DataSourceTracking {
  id: string;
  ledgerId?: string;          // 台帳番号
  displayName?: string;
  speciesName?: string;       // 和名
  scientificName?: string;    // 学名
  category: TreeCategory;
  trunkDiameter?: number;     // cm (胸高直径)
  height?: number;            // meters (樹高)
  crownSpread?: number;       // meters (枝張り)
  datePlanted?: string;       // ISO 8601 timestamp
  estimatedAge?: number;      // years
  healthStatus: TreeHealthStatus;
  conditionGrade?: ConditionGrade;
  lastDiagnosticDate?: string;  // ISO 8601 timestamp
  diagnosticNotes?: string;
  geometry: Point;
  status: AssetStatus;
  condition?: AssetCondition;
  riskLevel?: AssetRiskLevel;
  ward?: string;
  managingDept?: string;
  roadRef?: string;           // Reference to road_assets.id
  greenSpaceRef?: string;     // Reference to greenspace_assets.id
  createdAt: string;          // ISO 8601 timestamp
  updatedAt: string;          // ISO 8601 timestamp
}

// ============================================
// NEW: Park Facility Asset Entity (RFI: 公園管理 施設情報)
// ============================================
export interface ParkFacilityAsset extends DataSourceTracking {
  id: string;
  facilityId?: string;        // 施設管理番号
  name: string;
  description?: string;
  category: ParkFacilityCategory;
  subCategory?: string;
  dateInstalled?: string;     // ISO 8601 timestamp
  manufacturer?: string;
  material?: string;
  quantity?: number;
  designLife?: number;        // years (設計供用年数)
  conditionGrade?: ConditionGrade;
  lastInspectionDate?: string;  // ISO 8601 timestamp
  nextInspectionDate?: string;  // ISO 8601 timestamp
  safetyConcern?: boolean;
  geometry: SupportedGeometry;  // Point or Polygon
  status: AssetStatus;
  condition?: AssetCondition;
  riskLevel?: AssetRiskLevel;
  ward?: string;
  managingDept?: string;
  greenSpaceRef: string;      // Reference to greenspace_assets.id (required)
  createdAt: string;
  updatedAt: string;
}

// ============================================
// NEW: Pavement Section Asset Entity (RFI: 舗装維持補修支援)
// ============================================
export interface PavementSectionAsset extends DataSourceTracking {
  id: string;
  sectionId?: string;         // 区間管理番号
  name?: string;
  routeNumber?: string;       // 路線番号
  pavementType: PavementType;
  length?: number;            // meters
  width?: number;             // meters
  thickness?: number;         // cm
  lastResurfacingDate?: string;  // ISO 8601 timestamp
  // Condition indices (路面性状値)
  mci?: number;               // Maintenance Control Index (0-10)
  crackRate?: number;         // % (ひび割れ率)
  rutDepth?: number;          // mm (わだち掘れ量)
  iri?: number;               // m/km (International Roughness Index)
  lastMeasurementDate?: string;  // ISO 8601 timestamp
  // Planning
  plannedInterventionYear?: number;
  estimatedCost?: number;     // JPY
  priorityRank?: number;
  geometry: SupportedGeometry;  // LineString or Polygon
  status: AssetStatus;
  condition?: AssetCondition;
  riskLevel?: AssetRiskLevel;
  ward?: string;
  managingDept?: string;
  roadRef: string;            // Reference to road_assets.id (required)
  createdAt: string;
  updatedAt: string;
}

// ============================================
// NEW: Pump Station Asset Entity (RFI: ポンプ施設管理)
// ============================================
export interface PumpStationAsset extends DataSourceTracking {
  id: string;
  stationId?: string;         // 施設管理番号
  name: string;
  description?: string;
  category: PumpStationCategory;
  dateCommissioned?: string;  // ISO 8601 timestamp
  designCapacity?: number;    // m³/min
  pumpCount?: number;
  totalPower?: number;        // kW
  drainageArea?: number;      // ha
  equipmentStatus: PumpEquipmentStatus;
  conditionGrade?: ConditionGrade;
  lastMaintenanceDate?: string;  // ISO 8601 timestamp
  nextMaintenanceDate?: string;  // ISO 8601 timestamp
  geometry: SupportedGeometry;  // Point or Polygon
  status: AssetStatus;
  condition?: AssetCondition;
  riskLevel?: AssetRiskLevel;
  ward?: string;
  managingDept?: string;
  managingOffice?: string;
  riverRef?: string;          // Reference to river_assets.id
  createdAt: string;
  updatedAt: string;
}

// ============================================
// NEW: Lifecycle Plan Entity (RFI: 長寿命化計画 / LCC)
// ============================================
export interface LifecyclePlan {
  id: string;
  title: string;
  version?: string;
  planStartYear: number;
  planEndYear: number;
  planStatus: LifecyclePlanStatus;
  assetType: string;          // 'ParkFacility' | 'PavementSection' | 'PumpStation' | 'StreetTree'
  baselineCondition?: ConditionGrade;
  designLife?: number;        // years
  remainingLife?: number;     // years
  interventions?: Array<{
    year: number;
    type: InterventionType;
    description?: string;
    estimatedCostJpy: number;
  }>;
  totalLifecycleCostJpy?: number;
  annualAverageCostJpy?: number;
  assetRef?: string;          // Reference to any asset's id
  managingDept?: string;
  createdBy?: string;
  approvedAt?: string;        // ISO 8601 timestamp
  createdAt: string;
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

// Inspection Record entity (expanded for cross-asset inspection support)
// Legacy: eventId/roadAssetId preserved; new assetType+assetId takes precedence
export interface InspectionRecord {
  id: string;
  // Legacy references (preserved for backward compatibility)
  eventId: string | null;         // FK to construction_events
  roadAssetId: string | null;     // FK to road_assets
  // New generic asset reference (takes precedence when set)
  assetType?: string | null;      // 'road' | 'street-tree' | 'park-facility' | 'pavement-section' | 'pump-station'
  assetId?: string | null;        // Reference to any asset table's id
  // Core inspection fields
  inspectionDate: string;         // ISO 8601 date
  inspectionType?: InspectionType | null;
  result: string;
  conditionGrade?: ConditionGrade | null;
  findings?: string | null;
  notes?: string;
  // Inspector info
  inspector?: string | null;
  inspectorOrganization?: string | null;
  // Measurements and media
  measurements?: Record<string, unknown> | null;  // Flexible measurement data
  mediaUrls?: string[] | null;    // Photo/document URLs
  // Location
  geometry: Point;
  // Work order reference
  refWorkOrderId?: string | null;
  createdAt: string;              // ISO 8601 timestamp
  updatedAt: string;              // ISO 8601 timestamp
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

// Evidence review status (workflow: pending -> approved/rejected -> accepted_by_authority)
export type EvidenceReviewStatus = 'pending' | 'approved' | 'rejected' | 'accepted_by_authority';

// Evidence submitter role
export type EvidenceSubmitterRole = 'partner' | 'gov_inspector';

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
  // Submission
  submittedBy: string;
  submittedAt: string;      // ISO 8601 timestamp
  submitterPartnerId?: string | null;  // Partner ID who submitted
  submitterRole?: EvidenceSubmitterRole | null;  // 'partner' | 'gov_inspector'
  // First-level review
  reviewedBy?: string;
  reviewedAt?: string;      // ISO 8601 timestamp
  reviewStatus: EvidenceReviewStatus;
  reviewNotes?: string;
  // Government decision
  decisionBy?: string | null;    // Gov role who made final decision
  decisionAt?: string | null;    // ISO 8601 timestamp
  decisionNotes?: string | null; // Decision notes/reason
}

// GeoJSON Feature types for map rendering
export type ConstructionEventFeature = Feature<SupportedGeometry, ConstructionEvent>;
export type RoadAssetFeature = Feature<SupportedGeometry, RoadAsset>;
export type InspectionFeature = Feature<Point, InspectionRecord>;

// NEW: Feature types for new asset types
export type RiverAssetFeature = Feature<SupportedGeometry, RiverAsset>;
export type GreenSpaceAssetFeature = Feature<Polygon, GreenSpaceAsset>;
export type StreetLightAssetFeature = Feature<Point, StreetLightAsset>;

// NEW: Feature types for RFI asset types
export type StreetTreeAssetFeature = Feature<Point, StreetTreeAsset>;
export type ParkFacilityAssetFeature = Feature<SupportedGeometry, ParkFacilityAsset>;
export type PavementSectionAssetFeature = Feature<SupportedGeometry, PavementSectionAsset>;
export type PumpStationAssetFeature = Feature<SupportedGeometry, PumpStationAsset>;

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
  // Reference to a related asset (singular, optional)
  refAssetId?: string;
  refAssetType?: AssetTypeRef;
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
  // Reference to a related asset (singular, can set to null to clear)
  refAssetId?: string | null;
  refAssetType?: AssetTypeRef | null;
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

// Review evidence (first-level review by department)
export interface ReviewEvidenceRequest {
  reviewStatus: 'approved' | 'rejected';
  reviewNotes?: string;
}

// Make government decision on evidence (final verification)
export interface MakeEvidenceDecisionRequest {
  decision: 'accepted_by_authority' | 'rejected';
  decisionNotes?: string;
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

// ============================================
// NEW: Filter types for RFI asset types
// ============================================

export interface StreetTreeFilters {
  bbox: string;                // REQUIRED: "minLng,minLat,maxLng,maxLat"
  category?: TreeCategory | TreeCategory[];
  healthStatus?: TreeHealthStatus | TreeHealthStatus[];
  conditionGrade?: ConditionGrade | ConditionGrade[];
  ward?: string;
  q?: string;                  // Text search (speciesName, displayName)
  limit?: number;
  offset?: number;
}

export interface ParkFacilityFilters {
  bbox: string;                // REQUIRED
  category?: ParkFacilityCategory | ParkFacilityCategory[];
  conditionGrade?: ConditionGrade | ConditionGrade[];
  greenSpaceRef?: string;
  ward?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface PavementSectionFilters {
  bbox: string;                // REQUIRED
  pavementType?: PavementType | PavementType[];
  priorityRank?: number;
  roadRef?: string;
  ward?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface PumpStationFilters {
  bbox: string;                // REQUIRED
  category?: PumpStationCategory | PumpStationCategory[];
  equipmentStatus?: PumpEquipmentStatus | PumpEquipmentStatus[];
  conditionGrade?: ConditionGrade | ConditionGrade[];
  ward?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface InspectionRecordFilters {
  bbox?: string;               // Optional for inspection records
  inspectionType?: InspectionType | InspectionType[];
  result?: InspectionResult | InspectionResult[];
  conditionGrade?: ConditionGrade | ConditionGrade[];
  assetType?: string;
  assetId?: string;
  ward?: string;
  limit?: number;
  offset?: number;
}

export interface LifecyclePlanFilters {
  assetType?: string;
  planStatus?: LifecyclePlanStatus | LifecyclePlanStatus[];
  assetRef?: string;
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
  | 'river'
  | 'street-tree'
  | 'park-facility'
  | 'pavement-section'
  | 'pump-station';

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
