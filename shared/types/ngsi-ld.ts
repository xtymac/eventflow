/**
 * NGSI-LD Core Types & Nagoya Construction Lifecycle Data Models
 *
 * Based on:
 * - ETSI GS CIM 009 V1.6.1 (NGSI-LD API)
 * - FIWARE Smart Data Models (smartdatamodels.org)
 * - Custom extensions for Nagoya municipal construction lifecycle
 *
 * Standards references:
 * - dataModel.Building (BuildingOperation) → CivicOperation
 * - dataModel.Transportation (Road, RoadSegment) → Road
 * - dataModel.ParksAndGardens (Garden) → GreenSpace
 * - dataModel.Streetlighting (Streetlight) → Streetlight
 * - dataModel.IssueTracking (IssueReporting) → WorkOrder
 * - dataModel.ParksAndGardens (FlowerBed) → StreetTree (extended)
 * - Custom: WaterBody, Evidence, ParkFacility, PavementSection, PumpStation,
 *           InspectionRecord, LifecyclePlan
 */

import type { Point, LineString, Polygon, MultiPolygon, Geometry } from 'geojson';

// ============================================================
// §1  NGSI-LD Core Information Model
// ============================================================

/** ISO 8601 date-time string */
export type DateTime = string;

/** URI identifier for entities */
export type URI = string;

/**
 * NGSI-LD Property — holds a data value
 * @see ETSI GS CIM 009 §4.5.2
 */
export interface Property<T = unknown> {
  type: 'Property';
  value: T;
  observedAt?: DateTime;
  unitCode?: string;              // UN/CEFACT Common Code (e.g. "CEL", "MTR", "WTT")
  datasetId?: URI;                // For multi-attribute support
}

/**
 * NGSI-LD Relationship — links one entity to another
 * @see ETSI GS CIM 009 §4.5.3
 */
export interface Relationship {
  type: 'Relationship';
  object: URI | URI[];            // Target entity ID(s)
  observedAt?: DateTime;
  datasetId?: URI;
}

/**
 * NGSI-LD GeoProperty — holds a GeoJSON geometry
 * @see ETSI GS CIM 009 §4.5.4
 */
export interface GeoProperty<G extends Geometry = Geometry> {
  type: 'GeoProperty';
  value: G;
  observedAt?: DateTime;
}

/**
 * Base NGSI-LD Entity
 * All domain entities extend this.
 * @see ETSI GS CIM 009 §4.5.1
 */
export interface NgsiLdEntity {
  id: URI;                        // urn:ngsi-ld:{Type}:{identifier}
  type: string;                   // Entity type name
  '@context': string | string[];  // JSON-LD @context references
  // System-managed temporal properties
  createdAt?: DateTime;
  modifiedAt?: DateTime;
}

// ============================================================
// §2  JSON-LD @context Definition
// ============================================================

/**
 * The project @context resolves short property names to full URIs.
 * At runtime, entities reference this via:
 *   "@context": [
 *     "https://nagoya-construction.example.org/ngsi-ld/v1/context.jsonld",
 *     "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"
 *   ]
 */
export const NAGOYA_CONTEXT = 'https://nagoya-construction.example.org/ngsi-ld/v1/context.jsonld' as const;
export const NGSI_LD_CORE_CONTEXT = 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld' as const;

export const DEFAULT_CONTEXT: string[] = [NAGOYA_CONTEXT, NGSI_LD_CORE_CONTEXT];

// ============================================================
// §3  Entity ID Helpers
// ============================================================

/** Entity type URN prefixes following NGSI-LD convention */
export const EntityTypePrefix = {
  CivicOperation: 'urn:ngsi-ld:CivicOperation:',
  WorkOrder: 'urn:ngsi-ld:WorkOrder:',
  Road: 'urn:ngsi-ld:Road:',
  RoadSegment: 'urn:ngsi-ld:RoadSegment:',
  GreenSpace: 'urn:ngsi-ld:GreenSpace:',
  Streetlight: 'urn:ngsi-ld:Streetlight:',
  WaterBody: 'urn:ngsi-ld:WaterBody:',
  Evidence: 'urn:ngsi-ld:Evidence:',
  Organization: 'urn:ngsi-ld:Organization:',
  DesignatedRoad: 'urn:ngsi-ld:DesignatedRoad:',
  BuildingZone: 'urn:ngsi-ld:BuildingZone:',
  StreetTree: 'urn:ngsi-ld:StreetTree:',
  ParkFacility: 'urn:ngsi-ld:ParkFacility:',
  PavementSection: 'urn:ngsi-ld:PavementSection:',
  PumpStation: 'urn:ngsi-ld:PumpStation:',
  InspectionRecord: 'urn:ngsi-ld:InspectionRecord:',
  LifecyclePlan: 'urn:ngsi-ld:LifecyclePlan:',
} as const;

export type EntityType = keyof typeof EntityTypePrefix;

/** Build a NGSI-LD entity URN from type and local ID */
export function entityId(type: EntityType, localId: string): URI {
  return `${EntityTypePrefix[type]}${localId}`;
}

// ============================================================
// §4  Enumeration Value Lists
//     (aligned with FIWARE Smart Data Models where applicable)
// ============================================================

/**
 * CivicOperation status lifecycle
 * Extends BuildingOperation.status with municipal governance stages
 * @see dataModel.Building/BuildingOperation → status
 */
export const CivicOperationStatus = {
  Planned: 'planned',
  Scheduled: 'scheduled',        // FIWARE-aligned (mapped from 'planned' in current DB)
  Ongoing: 'ongoing',            // FIWARE-aligned (mapped from 'active')
  PendingReview: 'pendingReview', // Custom extension
  Finished: 'finished',          // FIWARE-aligned (mapped from 'closed')
  Archived: 'archived',          // Custom extension
  Cancelled: 'cancelled',        // FIWARE-aligned
} as const;
export type CivicOperationStatusType = typeof CivicOperationStatus[keyof typeof CivicOperationStatus];

/** Work zone restriction types */
export const RestrictionCategory = {
  Full: 'fullClosure',
  Partial: 'partialClosure',
  WorkZone: 'workZone',
} as const;
export type RestrictionCategoryType = typeof RestrictionCategory[keyof typeof RestrictionCategory];

/** Post-end decision after operation completes */
export const PostEndDecision = {
  Pending: 'pending',
  NoChange: 'noChange',
  PermanentChange: 'permanentChange',
} as const;
export type PostEndDecisionType = typeof PostEndDecision[keyof typeof PostEndDecision];

/**
 * WorkOrder operation types
 * @see dataModel.IssueTracking/IssueReporting → category
 */
export const WorkOrderCategory = {
  Inspection: 'inspection',
  Repair: 'repair',
  Update: 'update',
} as const;
export type WorkOrderCategoryType = typeof WorkOrderCategory[keyof typeof WorkOrderCategory];

/**
 * WorkOrder resolution status
 * @see dataModel.IssueTracking/IssueReporting → resolutionStatus
 */
export const WorkOrderResolutionStatus = {
  Open: 'open',                  // FIWARE-aligned (mapped from 'draft')
  Assigned: 'assigned',          // FIWARE-aligned
  InProgress: 'inProgress',     // FIWARE-aligned
  Closed: 'closed',             // FIWARE-aligned (mapped from 'completed')
  Cancelled: 'cancelled',       // Extension
} as const;
export type WorkOrderResolutionStatusType = typeof WorkOrderResolutionStatus[keyof typeof WorkOrderResolutionStatus];

/**
 * Road classification
 * @see dataModel.Transportation/Road → roadClass
 */
export const RoadClass = {
  Motorway: 'motorway',
  Trunk: 'trunk',
  Primary: 'primary',
  Secondary: 'secondary',
  Tertiary: 'tertiary',
  Residential: 'residential',
  Service: 'service',
  Unclassified: 'unclassified',
  // Nagoya municipal additions
  Arterial: 'arterial',
  Collector: 'collector',
  Local: 'local',
} as const;
export type RoadClassType = typeof RoadClass[keyof typeof RoadClass];

/**
 * Green space category
 * @see dataModel.ParksAndGardens/Garden → category
 */
export const GreenSpaceCategory = {
  Park: 'park',
  Garden: 'garden',
  Grass: 'grass',
  Forest: 'forest',
  Meadow: 'meadow',
  Playground: 'playground',
  // FIWARE-aligned additions
  Botanical: 'botanical',
  Community: 'community',
  Public: 'public',
} as const;
export type GreenSpaceCategoryType = typeof GreenSpaceCategory[keyof typeof GreenSpaceCategory];

/**
 * Streetlight lamp technology
 * @see dataModel.Streetlighting/Streetlight → lampTechnology
 */
export const LampTechnology = {
  LED: 'LED',
  LPS: 'LPS',               // Low-pressure sodium (FIWARE value)
  HPS: 'HPS',               // High-pressure sodium (FIWARE value)
  MercuryVapor: 'mercuryVapor',
  Fluorescent: 'fluorescent',
  Halogen: 'halogen',
} as const;
export type LampTechnologyType = typeof LampTechnology[keyof typeof LampTechnology];

/** Streetlight operational status */
export const StreetlightStatus = {
  Ok: 'ok',                  // Functioning
  Defective: 'defective',   // Not functioning
  UnderMaintenance: 'underMaintenance',
  Damaged: 'damaged',
  Replaced: 'replaced',
} as const;
export type StreetlightStatusType = typeof StreetlightStatus[keyof typeof StreetlightStatus];

/** Waterway classification */
export const WaterwayCategory = {
  River: 'river',
  Stream: 'stream',
  Canal: 'canal',
  Drain: 'drain',
} as const;
export type WaterwayCategoryType = typeof WaterwayCategory[keyof typeof WaterwayCategory];

/** Evidence media type */
export const EvidenceMediaType = {
  Photo: 'photo',
  Document: 'document',
  Report: 'report',
  CAD: 'cad',
  Other: 'other',
} as const;
export type EvidenceMediaTypeValue = typeof EvidenceMediaType[keyof typeof EvidenceMediaType];

/** Evidence review status (workflow: pending -> approved/rejected -> accepted_by_authority) */
export const EvidenceReviewStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  AcceptedByAuthority: 'accepted_by_authority',
} as const;
export type EvidenceReviewStatusType = typeof EvidenceReviewStatus[keyof typeof EvidenceReviewStatus];

/** Evidence submitter role */
export const EvidenceSubmitterRole = {
  Partner: 'partner',
  GovInspector: 'gov_inspector',
} as const;
export type EvidenceSubmitterRoleType = typeof EvidenceSubmitterRole[keyof typeof EvidenceSubmitterRole];

/** Partner (contractor) role in a WorkOrder */
export const PartnerRole = {
  Contractor: 'contractor',
  Inspector: 'inspector',
  Reviewer: 'reviewer',
} as const;
export type PartnerRoleType = typeof PartnerRole[keyof typeof PartnerRole];

/** Asset data lifecycle status */
export const AssetLifecycleStatus = {
  Active: 'active',
  Inactive: 'inactive',
  Retired: 'retired',
  Removed: 'removed',
} as const;
export type AssetLifecycleStatusType = typeof AssetLifecycleStatus[keyof typeof AssetLifecycleStatus];

/** Data provenance source */
export const DataProvenance = {
  OsmTest: 'osm_test',
  OfficialLedger: 'official_ledger',
  Manual: 'manual',
  MvtSync: 'mvt_sync',
} as const;
export type DataProvenanceType = typeof DataProvenance[keyof typeof DataProvenance];

/** Administrative management level */
export const ManagementLevel = {
  National: 'national',
  Prefectural: 'prefectural',
  Municipal: 'municipal',
} as const;
export type ManagementLevelType = typeof ManagementLevel[keyof typeof ManagementLevel];

// ---- RFI追加: 街路樹 (Street Tree) ----

/** Tree species classification */
export const TreeCategory = {
  Deciduous: 'deciduous',         // 落葉樹
  Evergreen: 'evergreen',         // 常緑樹
  Conifer: 'conifer',             // 針葉樹
  PalmLike: 'palmLike',           // ヤシ類
  Shrub: 'shrub',                 // 低木・生垣
} as const;
export type TreeCategoryType = typeof TreeCategory[keyof typeof TreeCategory];

/** Tree health / vitality status */
export const TreeHealthStatus = {
  Healthy: 'healthy',             // 健全
  Declining: 'declining',         // 衰弱
  Hazardous: 'hazardous',        // 危険（倒木リスク）
  Dead: 'dead',                   // 枯死
  Removed: 'removed',            // 撤去済み
} as const;
export type TreeHealthStatusType = typeof TreeHealthStatus[keyof typeof TreeHealthStatus];

// ---- RFI追加: 公園施設 (Park Facility) ----

/**
 * Park facility type classification
 * Based on Nagoya 公園管理システム subsystem requirements
 */
export const ParkFacilityCategory = {
  Toilet: 'toilet',               // 公衆トイレ
  Playground: 'playground',       // 遊具
  Bench: 'bench',                 // ベンチ
  Shelter: 'shelter',             // 東屋・あずまや
  Fence: 'fence',                 // フェンス・柵
  Gate: 'gate',                   // 門・出入口
  Drainage: 'drainage',           // 排水設備
  Lighting: 'lighting',           // 園内照明
  WaterFountain: 'waterFountain', // 水飲み場
  SignBoard: 'signBoard',         // 案内看板
  Pavement: 'pavement',          // 園路舗装
  SportsFacility: 'sportsFacility', // 運動施設
  Building: 'building',           // 管理棟・倉庫
  Other: 'other',                 // その他
} as const;
export type ParkFacilityCategoryType = typeof ParkFacilityCategory[keyof typeof ParkFacilityCategory];

/** Facility condition grade (劣化度) */
export const ConditionGrade = {
  A: 'A',     // 健全（問題なし）
  B: 'B',     // 軽微な劣化
  C: 'C',     // 要補修
  D: 'D',     // 要改築・撤去
  S: 'S',     // 緊急対応
} as const;
export type ConditionGradeType = typeof ConditionGrade[keyof typeof ConditionGrade];

// ---- RFI追加: 道路舗装 (Pavement) ----

/** Pavement surface type */
export const PavementType = {
  Asphalt: 'asphalt',            // アスファルト
  Concrete: 'concrete',          // コンクリート
  Interlocking: 'interlocking',  // インターロッキング
  Gravel: 'gravel',              // 砂利
  Other: 'other',
} as const;
export type PavementTypeValue = typeof PavementType[keyof typeof PavementType];

// ---- RFI追加: ポンプ施設 (Pump Station) ----

/** Pump station type classification */
export const PumpStationCategory = {
  Stormwater: 'stormwater',      // 雨水ポンプ
  Sewage: 'sewage',              // 汚水ポンプ
  Irrigation: 'irrigation',     // 灌漑ポンプ
  Combined: 'combined',          // 合流式ポンプ
} as const;
export type PumpStationCategoryType = typeof PumpStationCategory[keyof typeof PumpStationCategory];

/** Pump equipment status */
export const PumpEquipmentStatus = {
  Operational: 'operational',    // 稼働中
  Standby: 'standby',           // 待機
  UnderMaintenance: 'underMaintenance', // 整備中
  OutOfService: 'outOfService',  // 運用停止
} as const;
export type PumpEquipmentStatusType = typeof PumpEquipmentStatus[keyof typeof PumpEquipmentStatus];

// ---- RFI追加: 点検・診断 (Inspection) ----

/** Inspection type */
export const InspectionType = {
  Routine: 'routine',            // 定期点検
  Detailed: 'detailed',          // 詳細点検
  Emergency: 'emergency',       // 緊急点検
  Diagnostic: 'diagnostic',     // 診断調査
} as const;
export type InspectionTypeValue = typeof InspectionType[keyof typeof InspectionType];

/** Inspection result summary */
export const InspectionResult = {
  Pass: 'pass',                  // 合格・問題なし
  Minor: 'minor',                // 軽微な異常
  NeedsRepair: 'needsRepair',  // 要補修
  Critical: 'critical',          // 要緊急対応
} as const;
export type InspectionResultType = typeof InspectionResult[keyof typeof InspectionResult];

// ---- RFI追加: 長寿命化計画 (Lifecycle Plan) ----

/** Lifecycle plan intervention type */
export const InterventionType = {
  Repair: 'repair',              // 補修
  Renewal: 'renewal',            // 更新
  Replacement: 'replacement',   // 取替
  Removal: 'removal',            // 撤去
} as const;
export type InterventionTypeValue = typeof InterventionType[keyof typeof InterventionType];

// ============================================================
// §5  Domain Entity Definitions (NGSI-LD Normalized Format)
// ============================================================

// ----- 5.1  CivicOperation -----
// Extension of FIWARE BuildingOperation generalized to any civic infrastructure
// @see https://github.com/smart-data-models/dataModel.Building/tree/master/BuildingOperation

/**
 * CivicOperation — A time-bound construction or maintenance operation
 * on municipal infrastructure (roads, parks, waterways, etc.)
 *
 * FIWARE base: BuildingOperation
 * Extension: Generalized from building-only to any civic asset;
 *            adds restriction zones, post-end decisions, governance workflow
 */
export interface CivicOperation extends NgsiLdEntity {
  type: 'CivicOperation';

  // --- Core properties (from BuildingOperation pattern) ---
  /** Human-readable operation name */
  name: Property<string>;
  /** Free-text description */
  description?: Property<string>;
  /** Current lifecycle status */
  status: Property<CivicOperationStatusType>;
  /** Planned start date */
  startDate: Property<DateTime>;
  /** Planned end date */
  endDate: Property<DateTime>;
  /** Actual start (set when status → ongoing) */
  dateStarted?: Property<DateTime>;
  /** Actual finish (set when status → finished) */
  dateFinished?: Property<DateTime>;
  /** Type of work zone restriction */
  restrictionCategory: Property<RestrictionCategoryType>;

  // --- Spatial ---
  /** Operation boundary polygon */
  location: GeoProperty<Polygon | MultiPolygon>;
  /** How geometry was derived: manual draw or auto-buffer */
  geometrySource?: Property<'manual' | 'auto'>;

  // --- Governance workflow ---
  /** Decision on permanent infrastructure changes after event ends */
  postEndDecision: Property<PostEndDecisionType>;
  /** Responsible municipal department */
  department: Property<string>;
  /** Ward / district code (名古屋市区) */
  ward?: Property<string>;
  /** Person/role who created the operation */
  createdBy?: Property<string>;
  /** Person/role who closed the operation */
  closedBy?: Property<string>;
  /** Timestamp of closure */
  closedAt?: Property<DateTime>;
  /** Notes recorded at closure */
  closeNotes?: Property<string>;
  /** Timestamp when archived */
  archivedAt?: Property<DateTime>;

  // --- Relationships ---
  /** Related road assets affected by this operation */
  refAffectedAsset?: Relationship;
  /** WorkOrders spawned from this operation */
  refWorkOrder?: Relationship;
  /** Reference to a specific asset this operation is related to (singular) */
  refAsset?: Relationship;

  // --- Provenance ---
  dataProvider?: Property<string>;
  source?: Property<string>;
}

// ----- 5.2  WorkOrder -----
// Based on FIWARE IssueReporting / Open311 ServiceRequest pattern
// @see https://github.com/smart-data-models/dataModel.IssueTracking

/**
 * WorkOrder — A specific task (inspection, repair, update) assigned
 * to a department or contractor under a CivicOperation.
 *
 * FIWARE base: IssueReporting
 * Extension: Adds multi-location, multi-partner, evidence review gate
 */
export interface WorkOrder extends NgsiLdEntity {
  type: 'WorkOrder';

  // --- Core properties ---
  /** Task title */
  title: Property<string>;
  /** Detailed description */
  description?: Property<string>;
  /** Work category (inspection, repair, update) */
  category: Property<WorkOrderCategoryType>;
  /** Current resolution status */
  resolutionStatus: Property<WorkOrderResolutionStatusType>;

  // --- Assignment ---
  /** Department responsible for execution */
  assignedDepartment?: Property<string>;
  /** Person/role who made the assignment */
  assignedBy?: Property<string>;
  /** Timestamp of assignment */
  assignedAt?: Property<DateTime>;

  // --- Timeline ---
  /** Deadline for completion */
  dueDate?: Property<DateTime>;
  /** Actual start timestamp */
  dateStarted?: Property<DateTime>;
  /** Actual completion timestamp */
  dateFinished?: Property<DateTime>;

  // --- Review gate ---
  /** Person who reviewed the completed work */
  reviewedBy?: Property<string>;
  /** Review timestamp */
  reviewedAt?: Property<DateTime>;
  /** Review notes */
  reviewNotes?: Property<string>;

  // --- Relationships ---
  /** Parent CivicOperation (required) */
  refCivicOperation: Relationship;
  /** Associated work locations with geometry */
  refWorkLocation?: Relationship;
  /** Assigned partners/contractors */
  refPartner?: Relationship;
  /** Attached evidence items */
  refEvidence?: Relationship;

  // --- Provenance ---
  createdBy?: Property<string>;
  dataProvider?: Property<string>;
}

/**
 * WorkLocation — A geographic point or area where a WorkOrder task is performed.
 * Embedded or linked as a sub-entity of WorkOrder.
 */
export interface WorkLocation extends NgsiLdEntity {
  type: 'WorkLocation';

  /** Geographic location of the work */
  location: GeoProperty;
  /** Type of asset at this location */
  assetType?: Property<string>;
  /** Note about this specific location */
  note?: Property<string>;
  /** Sequence order for multi-point routes */
  sequenceOrder: Property<number>;

  // --- Relationships ---
  /** Parent WorkOrder */
  refWorkOrder: Relationship;
  /** Referenced asset at this location (road, greenspace, etc.) */
  refAsset?: Relationship;
}

/**
 * Partner — A contractor, inspector, or reviewer assigned to a WorkOrder.
 * Modeled as a lightweight sub-entity.
 */
export interface Partner extends NgsiLdEntity {
  type: 'Organization';

  /** Organization / person name */
  name: Property<string>;
  /** Role in the work order */
  role: Property<PartnerRoleType>;
  /** Assignment timestamp */
  assignedAt: Property<DateTime>;

  // --- Relationships ---
  /** WorkOrder(s) this partner is assigned to */
  refWorkOrder: Relationship;
}

// ----- 5.3  Road -----
// FIWARE dataModel.Transportation/Road + RoadSegment
// @see https://github.com/smart-data-models/dataModel.Transportation

/**
 * Road — A logical road entity composed of one or more RoadSegments.
 *
 * FIWARE base: Road
 * Extension: Adds Japanese name fields, data provenance, OSM sync tracking,
 *            Nagoya municipal designation fields
 */
export interface Road extends NgsiLdEntity {
  type: 'Road';

  // --- Core properties (FIWARE Road) ---
  /** Road name */
  name?: Property<string>;
  /** Alternate name (Japanese) */
  alternateName?: Property<string>;
  /** Route reference code (e.g., 国道23号) */
  refCode?: Property<string>;
  /** Local reference code */
  localRef?: Property<string>;
  /** Computed display name (fallback chain: name → alternateName → refCode → localRef) */
  displayName?: Property<string>;
  /** Free-text description */
  description?: Property<string>;
  /** Road classification */
  roadClass: Property<RoadClassType>;
  /** Total length in meters */
  length?: Property<number>;
  /** Number of lanes */
  totalLaneNumber?: Property<number>;
  /** Direction of travel */
  direction?: Property<string>;
  /** Organization responsible for maintenance */
  responsible?: Property<string>;

  // --- Spatial ---
  /** Road centerline or polygon geometry */
  location: GeoProperty<LineString | Polygon>;

  // --- Lifecycle status ---
  /** Data lifecycle status */
  status: Property<AssetLifecycleStatusType>;
  /** Governance-level condition assessment */
  condition?: Property<string>;
  /** Governance-level risk level */
  riskLevel?: Property<string>;
  /** Start of validity period */
  validFrom: Property<DateTime>;
  /** End of validity period (retired roads) */
  validTo?: Property<DateTime>;

  // --- Nagoya municipal extensions ---
  /** Ward / district code */
  ward?: Property<string>;
  /** Nearby landmark reference */
  landmark?: Property<string>;
  /** 町名/丁目 sub-locality */
  sublocality?: Property<string>;
  /** Cross-section type */
  crossSection?: Property<string>;
  /** Managing department */
  managingDept?: Property<string>;
  /** Intersection info */
  intersection?: Property<string>;
  /** Pavement condition */
  pavementState?: Property<string>;

  // --- Name provenance ---
  /** Source of the name: osm, municipal, manual, google */
  nameSource?: Property<string>;
  /** Name match confidence level */
  nameConfidence?: Property<string>;

  // --- Data provenance ---
  /** Data source identifier */
  dataProvider?: Property<DataProvenanceType>;
  /** Source dataset version */
  sourceVersion?: Property<string>;
  /** Source dataset date */
  sourceDate?: Property<DateTime>;
  /** Last verification timestamp */
  lastVerifiedAt?: Property<DateTime>;

  // --- OSM sync tracking ---
  /** OSM element type (node/way/relation) */
  osmType?: Property<string>;
  /** OpenStreetMap ID */
  osmId?: Property<number>;
  /** OSM last-modified timestamp */
  osmTimestamp?: Property<DateTime>;
  /** Last sync from Overpass API */
  lastSyncedAt?: Property<DateTime>;
  /** Whether manually edited (skip OSM sync) */
  isManuallyEdited?: Property<boolean>;

  // --- Relationships ---
  /** Segments composing this road */
  refRoadSegment?: Relationship;
  /** Replacement road (for retired roads) */
  refReplacedBy?: Relationship;
}

// ----- 5.4  GreenSpace -----
// Based on FIWARE dataModel.ParksAndGardens/Garden
// @see https://github.com/smart-data-models/dataModel.ParksAndGardens

/**
 * GreenSpace — A park, garden, or green area in the municipality.
 *
 * FIWARE base: Garden
 * Extension: Adds OSM-specific type tags, area calculation, vegetation classification
 */
export interface GreenSpace extends NgsiLdEntity {
  type: 'GreenSpace';

  // --- Core properties (FIWARE Garden) ---
  /** Name of the green space */
  name?: Property<string>;
  /** Japanese name */
  alternateName?: Property<string>;
  /** Computed display name */
  displayName?: Property<string>;
  /** Free-text description */
  description?: Property<string>;
  /** Green space classification */
  category: Property<GreenSpaceCategoryType>;
  /** Operating organization */
  operator?: Property<string>;
  /** Opening hours specification */
  openingHours?: Property<string[]>;

  // --- Spatial ---
  /** Boundary polygon */
  location: GeoProperty<Polygon>;
  /** Area in square meters */
  areaServed?: Property<number>;

  // --- Classification extensions ---
  /** OSM leisure tag */
  leisureType?: Property<string>;
  /** OSM landuse tag */
  landuseType?: Property<string>;
  /** OSM natural tag */
  naturalType?: Property<string>;
  /** Vegetation type classification */
  vegetationType?: Property<string>;

  // --- Status ---
  /** Data lifecycle status */
  status: Property<AssetLifecycleStatusType>;
  /** Governance-level condition assessment */
  condition?: Property<string>;
  /** Governance-level risk level */
  riskLevel?: Property<string>;
  /** Ward / district */
  ward?: Property<string>;

  // --- Data provenance ---
  dataProvider?: Property<DataProvenanceType>;
  sourceVersion?: Property<string>;
  sourceDate?: Property<DateTime>;
  lastVerifiedAt?: Property<DateTime>;

  // --- OSM sync tracking ---
  osmType?: Property<string>;
  osmId?: Property<number>;
  osmTimestamp?: Property<DateTime>;
  lastSyncedAt?: Property<DateTime>;
  isManuallyEdited?: Property<boolean>;
}

// ----- 5.5  Streetlight -----
// FIWARE dataModel.Streetlighting/Streetlight
// @see https://github.com/smart-data-models/dataModel.Streetlighting

/**
 * Streetlight — A public lighting fixture on municipal infrastructure.
 *
 * FIWARE base: Streetlight
 * Extension: Adds equipment-level lamp status, road reference
 */
export interface Streetlight extends NgsiLdEntity {
  type: 'Streetlight';

  // --- Core properties (FIWARE Streetlight) ---
  /** Physical identification number */
  lampId?: Property<string>;
  /** Computed display name */
  displayName?: Property<string>;
  /** Lamp technology type */
  lampTechnology: Property<LampTechnologyType>;
  /** Power consumption in watts */
  powerConsumption?: Property<number>;
  /** Installation date */
  dateInstalled?: Property<DateTime>;
  /** Equipment operational status */
  operatingStatus: Property<StreetlightStatusType>;

  // --- Spatial ---
  /** Fixture location point */
  location: GeoProperty<Point>;

  // --- Status ---
  /** Data lifecycle status */
  status: Property<AssetLifecycleStatusType>;
  /** Governance-level condition assessment */
  condition?: Property<string>;
  /** Governance-level risk level */
  riskLevel?: Property<string>;
  /** Ward / district */
  ward?: Property<string>;

  // --- Relationships ---
  /** Road where this light is located */
  refRoad?: Relationship;

  // --- Data provenance ---
  dataProvider?: Property<DataProvenanceType>;
  sourceVersion?: Property<string>;
  sourceDate?: Property<DateTime>;
  lastVerifiedAt?: Property<DateTime>;

  // --- OSM sync tracking ---
  osmType?: Property<string>;
  osmId?: Property<number>;
  osmTimestamp?: Property<DateTime>;
  lastSyncedAt?: Property<DateTime>;
  isManuallyEdited?: Property<boolean>;
}

// ----- 5.6  WaterBody -----
// Custom entity — no direct FIWARE equivalent
// Follows NGSI-LD conventions and common property patterns

/**
 * WaterBody — A river, stream, canal, or other waterway in the municipality.
 *
 * Custom entity following NGSI-LD patterns.
 * No direct FIWARE Smart Data Model; uses common geographic + provenance patterns.
 */
export interface WaterBody extends NgsiLdEntity {
  type: 'WaterBody';

  // --- Core properties ---
  /** Waterway name */
  name?: Property<string>;
  /** Japanese name */
  alternateName?: Property<string>;
  /** Computed display name */
  displayName?: Property<string>;
  /** Waterway classification */
  category: Property<WaterwayCategoryType>;
  /** Average width in meters */
  width?: Property<number>;
  /** Administrative management level */
  managementLevel?: Property<ManagementLevelType>;
  /** Maintaining organization */
  maintainer?: Property<string>;

  // --- Spatial ---
  /** Centerline (LineString) or water body extent (Polygon) */
  location: GeoProperty<LineString | Polygon>;
  /** Geometry representation type (line vs polygon) */
  geometryRepresentation: Property<'line' | 'polygon' | 'collection'>;

  // --- Status ---
  /** Data lifecycle status */
  status: Property<AssetLifecycleStatusType>;
  /** Governance-level condition assessment */
  condition?: Property<string>;
  /** Governance-level risk level */
  riskLevel?: Property<string>;
  /** Ward / district */
  ward?: Property<string>;

  // --- Data provenance ---
  dataProvider?: Property<DataProvenanceType>;
  sourceVersion?: Property<string>;
  sourceDate?: Property<DateTime>;
  lastVerifiedAt?: Property<DateTime>;

  // --- OSM sync tracking ---
  osmType?: Property<string>;
  osmId?: Property<number>;
  osmTimestamp?: Property<DateTime>;
  lastSyncedAt?: Property<DateTime>;
  isManuallyEdited?: Property<boolean>;
}

// ----- 5.7  Evidence -----
// Custom entity — no direct FIWARE equivalent
// Relates to WorkOrder via refWorkOrder relationship

/**
 * Evidence — A photo, document, report, or CAD file attached to a WorkOrder
 * as proof of work completion or site condition documentation.
 *
 * Custom entity following NGSI-LD patterns.
 */
export interface Evidence extends NgsiLdEntity {
  type: 'Evidence';

  // --- Core properties ---
  /** Evidence title */
  title?: Property<string>;
  /** Free-text description */
  description?: Property<string>;
  /** Media / file type category */
  mediaType: Property<EvidenceMediaTypeValue>;
  /** Original file name */
  fileName: Property<string>;
  /** Storage path or URL */
  filePath: Property<string>;
  /** File size in bytes */
  fileSizeBytes?: Property<number>;
  /** MIME type (e.g., image/jpeg) */
  mimeType?: Property<string>;
  /** Date/time the evidence was captured in the field */
  captureDate?: Property<DateTime>;

  // --- Spatial ---
  /** Geotagged capture location */
  location?: GeoProperty<Point>;

  // --- Submission ---
  /** Person who submitted the evidence */
  submittedBy: Property<string>;
  /** Submission timestamp */
  submittedAt: Property<DateTime>;
  /** Partner ID who submitted (from X-Partner-Id header) */
  submitterPartnerId?: Property<string>;
  /** Role of submitter: partner or gov_inspector */
  submitterRole?: Property<EvidenceSubmitterRoleType>;

  // --- Review gate (first-level review) ---
  /** Current review status */
  reviewStatus: Property<EvidenceReviewStatusType>;
  /** Reviewer identity */
  reviewedBy?: Property<string>;
  /** Review timestamp */
  reviewedAt?: Property<DateTime>;
  /** Review notes / rejection reason */
  reviewNotes?: Property<string>;

  // --- Government decision (final verification) ---
  /** Government role who made final decision */
  decisionBy?: Property<string>;
  /** Decision timestamp */
  decisionAt?: Property<DateTime>;
  /** Decision notes / reason */
  decisionNotes?: Property<string>;

  // --- Relationships ---
  /** Parent WorkOrder */
  refWorkOrder: Relationship;
}

// ----- 5.8  DesignatedRoad (Nagoya Municipal Reference) -----

/**
 * DesignatedRoad — An officially designated road in the Nagoya municipal system.
 * Reference data synced from MVT tile services.
 */
export interface DesignatedRoad extends NgsiLdEntity {
  type: 'DesignatedRoad';

  /** Source layer identifier */
  sourceLayer: Property<string>;
  /** Key code for road designation */
  keycode?: Property<string>;
  /** Designation ledger number (台帳番号) */
  daichoBan?: Property<string>;
  /** Permit number (許可番号) */
  kyokaBan?: Property<string>;
  /** Designation date (指定日) */
  shiteiYmd?: Property<string>;
  /** Raw properties from source */
  rawProperties?: Property<Record<string, unknown>>;

  // --- Spatial ---
  /** Road geometry (typically LineString) */
  location: GeoProperty<LineString>;

  /** Sync timestamp */
  syncedAt: Property<DateTime>;
}

// ----- 5.9  BuildingZone (Nagoya Municipal Reference) -----

/**
 * BuildingZone — A building regulation zone in the Nagoya municipal system.
 * Reference data synced from MVT tile services.
 */
export interface BuildingZone extends NgsiLdEntity {
  type: 'BuildingZone';

  /** Zone type classification (区域種別) */
  zoneType?: Property<string>;
  /** Zone name */
  name?: Property<string>;
  /** Agreement name (協定名称) */
  kyoteiName?: Property<string>;
  /** Classification (区分) */
  kubun?: Property<string>;
  /** Certification date (認定日) */
  ninteiYmd?: Property<string>;
  /** Certification number (認定番号) */
  ninteiNo?: Property<string>;
  /** Area (面積) */
  area?: Property<string>;
  /** Raw properties from source */
  rawProperties?: Property<Record<string, unknown>>;

  // --- Spatial ---
  /** Zone boundary polygon */
  location: GeoProperty<Polygon>;

  /** Sync timestamp */
  syncedAt: Property<DateTime>;
}

// ----- 5.10  StreetTree (RFI: 街路樹維持管理台帳) -----
// Extension of FIWARE dataModel.ParksAndGardens patterns
// @see Nagoya RFI §3.3: 街路樹維持管理台帳システム

/**
 * StreetTree — A managed street tree or roadside planting in the municipality.
 *
 * Covers the Nagoya 街路樹維持管理台帳 subsystem requirements:
 * - Tree ledger management (台帳管理)
 * - Tree diagnostic records (診断情報管理)
 * - Location management via dedicated GIS (専用GIS)
 *
 * No direct FIWARE model; follows Garden/FlowerBed patterns.
 */
export interface StreetTree extends NgsiLdEntity {
  type: 'StreetTree';

  // --- Identification ---
  /** Management ledger number (台帳番号) */
  ledgerId?: Property<string>;
  /** Display name (species + location) */
  displayName?: Property<string>;
  /** Species common name (和名) */
  speciesName?: Property<string>;
  /** Species scientific name (学名) */
  scientificName?: Property<string>;
  /** Tree category (落葉/常緑/針葉 etc.) */
  category: Property<TreeCategoryType>;

  // --- Physical attributes ---
  /** Trunk diameter at breast height in cm (胸高直径) */
  trunkDiameter?: Property<number>;
  /** Height in meters (樹高) */
  height?: Property<number>;
  /** Crown spread in meters (枝張り) */
  crownSpread?: Property<number>;
  /** Planting date */
  datePlanted?: Property<DateTime>;
  /** Estimated age in years */
  estimatedAge?: Property<number>;

  // --- Health & diagnostics ---
  /** Current health status (健全度) */
  healthStatus: Property<TreeHealthStatusType>;
  /** Condition grade from last inspection (劣化度) */
  conditionGrade?: Property<ConditionGradeType>;
  /** Last diagnostic date */
  lastDiagnosticDate?: Property<DateTime>;
  /** Diagnostic notes */
  diagnosticNotes?: Property<string>;

  // --- Spatial ---
  /** Tree location point */
  location: GeoProperty<Point>;

  // --- Administrative ---
  /** Data lifecycle status */
  status: Property<AssetLifecycleStatusType>;
  /** Governance-level condition assessment */
  condition?: Property<string>;
  /** Governance-level risk level */
  riskLevel?: Property<string>;
  /** Ward / district */
  ward?: Property<string>;
  /** Managing department (e.g. 緑地維持課) */
  managingDept?: Property<string>;

  // --- Relationships ---
  /** Road where this tree is planted */
  refRoad?: Relationship;
  /** Park/greenspace if within a park */
  refGreenSpace?: Relationship;
  /** Related inspection records */
  refInspectionRecord?: Relationship;
  /** Related lifecycle plan */
  refLifecyclePlan?: Relationship;

  // --- Data provenance ---
  dataProvider?: Property<DataProvenanceType>;
  sourceVersion?: Property<string>;
  sourceDate?: Property<DateTime>;
  lastVerifiedAt?: Property<DateTime>;
  osmType?: Property<string>;
  osmId?: Property<number>;
}

// ----- 5.11  ParkFacility (RFI: 公園管理 施設情報) -----
// Covers parks subsystem: 施設情報管理 + 長寿命化計画
// @see Nagoya RFI §3.3: 公園管理システム

/**
 * ParkFacility — A physical facility or equipment within a municipal park.
 *
 * Covers the Nagoya 公園管理システム subsystem requirements:
 * - Park facility information management (施設情報管理)
 * - Lifecycle planning / LCC calculation (長寿命化計画)
 * - Includes: toilets, playground equipment, benches, shelters, fences,
 *   drainage, lighting, sport facilities, buildings, etc.
 */
export interface ParkFacility extends NgsiLdEntity {
  type: 'ParkFacility';

  // --- Identification ---
  /** Facility management ID (施設管理番号) */
  facilityId?: Property<string>;
  /** Facility name */
  name: Property<string>;
  /** Free-text description */
  description?: Property<string>;
  /** Facility type classification */
  category: Property<ParkFacilityCategoryType>;
  /** Sub-category detail (e.g. specific playground equipment type) */
  subCategory?: Property<string>;

  // --- Physical attributes ---
  /** Installation / construction date (設置日) */
  dateInstalled?: Property<DateTime>;
  /** Manufacturer or builder */
  manufacturer?: Property<string>;
  /** Material (e.g. steel, wood, concrete, FRP) */
  material?: Property<string>;
  /** Quantity (e.g. number of benches) */
  quantity?: Property<number>;
  /** Design service life in years (設計供用年数) */
  designLife?: Property<number>;

  // --- Condition assessment ---
  /** Current condition grade (劣化度) */
  conditionGrade?: Property<ConditionGradeType>;
  /** Last inspection date */
  lastInspectionDate?: Property<DateTime>;
  /** Next scheduled inspection */
  nextInspectionDate?: Property<DateTime>;
  /** Safety concern flag */
  safetyConcern?: Property<boolean>;

  // --- Spatial ---
  /** Facility location (point or polygon) */
  location: GeoProperty<Point | Polygon>;

  // --- Administrative ---
  /** Data lifecycle status */
  status: Property<AssetLifecycleStatusType>;
  /** Governance-level condition assessment */
  condition?: Property<string>;
  /** Governance-level risk level */
  riskLevel?: Property<string>;
  /** Ward / district */
  ward?: Property<string>;
  /** Managing department (e.g. 緑地管理課) */
  managingDept?: Property<string>;

  // --- Relationships ---
  /** Parent park / green space */
  refGreenSpace: Relationship;
  /** Related inspection records */
  refInspectionRecord?: Relationship;
  /** Related lifecycle plan */
  refLifecyclePlan?: Relationship;

  // --- Data provenance ---
  dataProvider?: Property<DataProvenanceType>;
  sourceVersion?: Property<string>;
  lastVerifiedAt?: Property<DateTime>;
}

// ----- 5.12  PavementSection (RFI: 舗装維持補修支援) -----
// @see Nagoya RFI §3.3: 舗装維持補修支援システム

/**
 * PavementSection — A managed section of road pavement for condition
 * monitoring and maintenance planning.
 *
 * Covers the Nagoya 舗装維持補修支援システム requirements:
 * - Arterial road pavement condition management (幹線道路の路面性状管理)
 * - 5-year project planning support (5か年事業計画支援)
 * - Pavement cost estimation (舗装した際の概算費用算出)
 * - Construction location registration (工事位置図登録)
 */
export interface PavementSection extends NgsiLdEntity {
  type: 'PavementSection';

  // --- Identification ---
  /** Section management ID (区間管理番号) */
  sectionId?: Property<string>;
  /** Section name or route designation */
  name?: Property<string>;
  /** Road route number (路線番号) */
  routeNumber?: Property<string>;

  // --- Pavement attributes ---
  /** Surface type */
  pavementType: Property<PavementTypeValue>;
  /** Section length in meters */
  length?: Property<number>;
  /** Section width in meters */
  width?: Property<number>;
  /** Pavement thickness in cm */
  thickness?: Property<number>;
  /** Year of last resurfacing (最終舗装年度) */
  lastResurfacingDate?: Property<DateTime>;

  // --- Condition indices (路面性状値) ---
  /**
   * MCI: Maintenance Control Index (維持管理指数)
   * Composite index used in Japan; typically 0-10 scale, ≥5 = good
   */
  mci?: Property<number>;
  /** Crack rate (ひび割れ率) in % */
  crackRate?: Property<number>;
  /** Rut depth (わだち掘れ量) in mm */
  rutDepth?: Property<number>;
  /** IRI: International Roughness Index (平坦性) in m/km */
  iri?: Property<number>;
  /** Date of last measurement */
  lastMeasurementDate?: Property<DateTime>;

  // --- Planning ---
  /** Planned year for next repair/renewal (計画年度) */
  plannedInterventionYear?: Property<number>;
  /** Estimated repair cost in JPY (概算費用) */
  estimatedCost?: Property<number>;
  /** Priority ranking for 5-year plan */
  priorityRank?: Property<number>;

  // --- Spatial ---
  /** Pavement section geometry (typically LineString along road centerline) */
  location: GeoProperty<LineString | Polygon>;

  // --- Administrative ---
  /** Data lifecycle status */
  status: Property<AssetLifecycleStatusType>;
  /** Governance-level condition assessment */
  condition?: Property<string>;
  /** Governance-level risk level */
  riskLevel?: Property<string>;
  /** Ward / district */
  ward?: Property<string>;
  /** Managing department (e.g. 道路維持課) */
  managingDept?: Property<string>;

  // --- Relationships ---
  /** Parent road */
  refRoad: Relationship;
  /** Related inspection records */
  refInspectionRecord?: Relationship;
  /** Related lifecycle plan */
  refLifecyclePlan?: Relationship;

  // --- Data provenance ---
  dataProvider?: Property<DataProvenanceType>;
  sourceVersion?: Property<string>;
  lastVerifiedAt?: Property<DateTime>;
}

// ----- 5.13  PumpStation (RFI: ポンプ施設管理) -----
// @see Nagoya RFI §3.3: ポンプ施設管理システム (調達対象外だが参照として定義)

/**
 * PumpStation — A pump facility for stormwater/sewage management.
 *
 * Covers the Nagoya ポンプ施設管理システム concepts:
 * - Pump facility information management (ポンプ施設情報管理)
 * - Maintenance information management (整備情報管理)
 * - Asset management (アセットマネジメント)
 *
 * Note: ポンプ施設管理 is out of RFI procurement scope but defined here
 * for data interoperability with the integrated GIS.
 */
export interface PumpStation extends NgsiLdEntity {
  type: 'PumpStation';

  // --- Identification ---
  /** Station management ID (施設管理番号) */
  stationId?: Property<string>;
  /** Station name */
  name: Property<string>;
  /** Free-text description */
  description?: Property<string>;
  /** Station type classification */
  category: Property<PumpStationCategoryType>;

  // --- Physical attributes ---
  /** Construction / commissioning date (竣工日) */
  dateCommissioned?: Property<DateTime>;
  /** Design capacity in m³/min (設計排水能力) */
  designCapacity?: Property<number>;
  /** Number of pump units */
  pumpCount?: Property<number>;
  /** Total motor power in kW */
  totalPower?: Property<number>;
  /** Drainage area served in ha (排水区域面積) */
  drainageArea?: Property<number>;

  // --- Equipment status ---
  /** Overall station equipment status */
  equipmentStatus: Property<PumpEquipmentStatusType>;
  /** Condition grade from latest assessment */
  conditionGrade?: Property<ConditionGradeType>;
  /** Last maintenance date */
  lastMaintenanceDate?: Property<DateTime>;
  /** Next scheduled maintenance */
  nextMaintenanceDate?: Property<DateTime>;

  // --- Spatial ---
  /** Station location (point or polygon for compound) */
  location: GeoProperty<Point | Polygon>;

  // --- Administrative ---
  /** Data lifecycle status */
  status: Property<AssetLifecycleStatusType>;
  /** Governance-level condition assessment */
  condition?: Property<string>;
  /** Governance-level risk level */
  riskLevel?: Property<string>;
  /** Ward / district */
  ward?: Property<string>;
  /** Managing department (e.g. 河川工務課) */
  managingDept?: Property<string>;
  /** Managing office (e.g. ポンプ施設管理事務所) */
  managingOffice?: Property<string>;

  // --- Relationships ---
  /** Related water body (river/canal being pumped) */
  refWaterBody?: Relationship;
  /** Related inspection records */
  refInspectionRecord?: Relationship;
  /** Related lifecycle plan */
  refLifecyclePlan?: Relationship;

  // --- Data provenance ---
  dataProvider?: Property<DataProvenanceType>;
  sourceVersion?: Property<string>;
  lastVerifiedAt?: Property<DateTime>;
}

// ----- 5.14  InspectionRecord (RFI: 点検・診断記録) -----
// Cross-cutting entity used by all asset subsystems

/**
 * InspectionRecord — A formal inspection or diagnostic assessment
 * performed on any municipal infrastructure asset.
 *
 * Cross-cutting entity used across all subsystems:
 * - 公園管理: 施設点検 → conditionGrade
 * - 街路樹: 診断情報管理 → tree health assessment
 * - 舗装維持: 路面性状調査 → MCI/crack/rut measurements
 * - ポンプ施設: 設備点検 → equipment condition
 */
export interface InspectionRecord extends NgsiLdEntity {
  type: 'InspectionRecord';

  // --- Core properties ---
  /** Inspection title / label */
  title?: Property<string>;
  /** Inspection type (routine, detailed, emergency, diagnostic) */
  inspectionType: Property<InspectionTypeValue>;
  /** Date inspection was conducted */
  inspectionDate: Property<DateTime>;
  /** Overall result */
  result: Property<InspectionResultType>;
  /** Assigned condition grade */
  conditionGrade?: Property<ConditionGradeType>;
  /** Detailed notes / findings (所見) */
  findings?: Property<string>;

  // --- Inspector ---
  /** Inspector name or organization */
  inspector?: Property<string>;
  /** Inspector affiliation */
  inspectorOrganization?: Property<string>;

  // --- Measurements (if applicable) ---
  /** Raw measurement data (JSONB-like flexible structure) */
  measurements?: Property<Record<string, unknown>>;

  // --- Spatial ---
  /** Inspection location */
  location?: GeoProperty<Point | Polygon>;

  // --- Media ---
  /** Photo URLs or references */
  mediaUrls?: Property<string[]>;

  // --- Relationships ---
  /** Inspected asset (any entity type) */
  refInspectedAsset: Relationship;
  /** Parent CivicOperation (if inspection was part of an event) */
  refCivicOperation?: Relationship;
  /** Parent WorkOrder (if inspection was a work order task) */
  refWorkOrder?: Relationship;
  /** Attached evidence items */
  refEvidence?: Relationship;

  // --- Data provenance ---
  dataProvider?: Property<DataProvenanceType>;
}

// ----- 5.15  LifecyclePlan (RFI: 長寿命化計画 / LCC) -----
// @see Nagoya 公園管理システム: 長寿命化計画

/**
 * LifecyclePlan — A lifecycle cost / longevity plan for an infrastructure asset.
 *
 * Covers the Nagoya 長寿命化計画 (Lifecycle Cost / LCC) requirements:
 * - 公園管理: Long-life planning program output (長寿命化プログラム(LCC)で出力)
 * - ポンプ施設: Asset management planning
 * - 舗装維持: 5-year project planning (5か年事業計画支援)
 *
 * Each plan links to a specific asset and contains projected interventions
 * with cost estimates across a planning horizon.
 */
export interface LifecyclePlan extends NgsiLdEntity {
  type: 'LifecyclePlan';

  // --- Core properties ---
  /** Plan title / label */
  title: Property<string>;
  /** Plan version */
  version?: Property<string>;
  /** Planning horizon start year */
  planStartYear: Property<number>;
  /** Planning horizon end year */
  planEndYear: Property<number>;
  /** Plan status */
  planStatus?: Property<'draft' | 'approved' | 'active' | 'archived'>;

  // --- Asset baseline ---
  /** Asset type being planned (e.g. 'ParkFacility', 'PavementSection') */
  assetType: Property<string>;
  /** Current condition grade at plan creation */
  baselineCondition?: Property<ConditionGradeType>;
  /** Design service life in years */
  designLife?: Property<number>;
  /** Remaining service life in years */
  remainingLife?: Property<number>;

  // --- Cost projections ---
  /**
   * Planned interventions with year, type, and estimated cost.
   * Array of { year, type, description, estimatedCostJpy }
   */
  interventions?: Property<Array<{
    year: number;
    type: InterventionTypeValue;
    description?: string;
    estimatedCostJpy: number;
  }>>;
  /** Total lifecycle cost over planning horizon in JPY */
  totalLifecycleCostJpy?: Property<number>;
  /** Annual average cost in JPY */
  annualAverageCostJpy?: Property<number>;

  // --- Relationships ---
  /** Target asset this plan covers */
  refAsset: Relationship;
  /** Related inspection records informing the plan */
  refInspectionRecord?: Relationship;

  // --- Administrative ---
  /** Responsible department */
  managingDept?: Property<string>;
  /** Plan author */
  createdBy?: Property<string>;
  /** Approval date */
  approvedAt?: Property<DateTime>;

  // --- Data provenance ---
  dataProvider?: Property<DataProvenanceType>;
}

// ============================================================
// §6  Entity Union Type
// ============================================================

/** All NGSI-LD entities in the Nagoya domain */
export type NagoyaEntity =
  | CivicOperation
  | WorkOrder
  | WorkLocation
  | Partner
  | Road
  | GreenSpace
  | Streetlight
  | WaterBody
  | Evidence
  | DesignatedRoad
  | BuildingZone
  // RFI追加エンティティ
  | StreetTree
  | ParkFacility
  | PavementSection
  | PumpStation
  | InspectionRecord
  | LifecyclePlan;

// ============================================================
// §7  Relationship Graph
// ============================================================

/**
 * Entity Relationship Map (for documentation / visualization)
 *
 * ┌─────────────────────── EVENT/CASE LAYER ───────────────────────┐
 * │                                                                │
 * │ CivicOperation ──refAffectedAsset──▶ (any asset)              │
 * │       │                                                        │
 * │       ├──refWorkOrder──▶ WorkOrder                             │
 * │       │                     │                                  │
 * │       │                     ├──refWorkLocation──▶ WorkLocation │
 * │       │                     │                      └──refAsset─┤──▶ (any asset)
 * │       │                     ├──refPartner──▶ Organization      │
 * │       │                     └──refEvidence──▶ Evidence         │
 * │       │                                                        │
 * │       └──refInspectionRecord──▶ InspectionRecord              │
 * │                                   └──refInspectedAsset────────┤──▶ (any asset)
 * └────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────── MASTER DATA LAYER ─────────────────────┐
 * │                                                                │
 * │ Road ──refRoadSegment──▶ RoadSegment (future)                 │
 * │    └──refReplacedBy──▶ Road                                   │
 * │                                                                │
 * │ GreenSpace ◀──refGreenSpace── ParkFacility                   │
 * │                                  └──refLifecyclePlan──▶ LCP   │
 * │                                                                │
 * │ StreetTree ──refRoad──▶ Road                                  │
 * │           └──refGreenSpace──▶ GreenSpace                      │
 * │           └──refInspectionRecord──▶ InspectionRecord          │
 * │           └──refLifecyclePlan──▶ LifecyclePlan                │
 * │                                                                │
 * │ Streetlight ──refRoad──▶ Road                                 │
 * │                                                                │
 * │ PavementSection ──refRoad──▶ Road                             │
 * │                  └──refLifecyclePlan──▶ LifecyclePlan         │
 * │                                                                │
 * │ PumpStation ──refWaterBody──▶ WaterBody                       │
 * │            └──refLifecyclePlan──▶ LifecyclePlan               │
 * │                                                                │
 * │ LifecyclePlan ──refAsset──▶ (any asset)                       │
 * │               └──refInspectionRecord──▶ InspectionRecord      │
 * └────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────── REFERENCE LAYER ───────────────────────┐
 * │ DesignatedRoad (no operational relationships)                  │
 * │ BuildingZone   (no operational relationships)                  │
 * └────────────────────────────────────────────────────────────────┘
 */
