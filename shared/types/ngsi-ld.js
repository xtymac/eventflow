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
export const NAGOYA_CONTEXT = 'https://nagoya-construction.example.org/ngsi-ld/v1/context.jsonld';
export const NGSI_LD_CORE_CONTEXT = 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld';
export const DEFAULT_CONTEXT = [NAGOYA_CONTEXT, NGSI_LD_CORE_CONTEXT];
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
};
/** Build a NGSI-LD entity URN from type and local ID */
export function entityId(type, localId) {
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
    Scheduled: 'scheduled', // FIWARE-aligned (mapped from 'planned' in current DB)
    Ongoing: 'ongoing', // FIWARE-aligned (mapped from 'active')
    PendingReview: 'pendingReview', // Custom extension
    Finished: 'finished', // FIWARE-aligned (mapped from 'closed')
    Archived: 'archived', // Custom extension
    Cancelled: 'cancelled', // FIWARE-aligned
};
/** Work zone restriction types */
export const RestrictionCategory = {
    Full: 'fullClosure',
    Partial: 'partialClosure',
    WorkZone: 'workZone',
};
/** Post-end decision after operation completes */
export const PostEndDecision = {
    Pending: 'pending',
    NoChange: 'noChange',
    PermanentChange: 'permanentChange',
};
/**
 * WorkOrder operation types
 * @see dataModel.IssueTracking/IssueReporting → category
 */
export const WorkOrderCategory = {
    Inspection: 'inspection',
    Repair: 'repair',
    Update: 'update',
};
/**
 * WorkOrder resolution status
 * @see dataModel.IssueTracking/IssueReporting → resolutionStatus
 */
export const WorkOrderResolutionStatus = {
    Open: 'open', // FIWARE-aligned (mapped from 'draft')
    Assigned: 'assigned', // FIWARE-aligned
    InProgress: 'inProgress', // FIWARE-aligned
    Closed: 'closed', // FIWARE-aligned (mapped from 'completed')
    Cancelled: 'cancelled', // Extension
};
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
};
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
};
/**
 * Streetlight lamp technology
 * @see dataModel.Streetlighting/Streetlight → lampTechnology
 */
export const LampTechnology = {
    LED: 'LED',
    LPS: 'LPS', // Low-pressure sodium (FIWARE value)
    HPS: 'HPS', // High-pressure sodium (FIWARE value)
    MercuryVapor: 'mercuryVapor',
    Fluorescent: 'fluorescent',
    Halogen: 'halogen',
};
/** Streetlight operational status */
export const StreetlightStatus = {
    Ok: 'ok', // Functioning
    Defective: 'defective', // Not functioning
    UnderMaintenance: 'underMaintenance',
    Damaged: 'damaged',
    Replaced: 'replaced',
};
/** Waterway classification */
export const WaterwayCategory = {
    River: 'river',
    Stream: 'stream',
    Canal: 'canal',
    Drain: 'drain',
};
/** Evidence media type */
export const EvidenceMediaType = {
    Photo: 'photo',
    Document: 'document',
    Report: 'report',
    CAD: 'cad',
    Other: 'other',
};
/** Evidence review status (workflow: pending -> approved/rejected -> accepted_by_authority) */
export const EvidenceReviewStatus = {
    Pending: 'pending',
    Approved: 'approved',
    Rejected: 'rejected',
    AcceptedByAuthority: 'accepted_by_authority',
};
/** Evidence submitter role */
export const EvidenceSubmitterRole = {
    Partner: 'partner',
    GovInspector: 'gov_inspector',
};
/** Partner (contractor) role in a WorkOrder */
export const PartnerRole = {
    Contractor: 'contractor',
    Inspector: 'inspector',
    Reviewer: 'reviewer',
};
/** Asset data lifecycle status */
export const AssetLifecycleStatus = {
    Active: 'active',
    Inactive: 'inactive',
    Retired: 'retired',
    Removed: 'removed',
};
/** Data provenance source */
export const DataProvenance = {
    OsmTest: 'osm_test',
    OfficialLedger: 'official_ledger',
    Manual: 'manual',
    MvtSync: 'mvt_sync',
};
/** Administrative management level */
export const ManagementLevel = {
    National: 'national',
    Prefectural: 'prefectural',
    Municipal: 'municipal',
};
// ---- RFI追加: 街路樹 (Street Tree) ----
/** Tree species classification */
export const TreeCategory = {
    Deciduous: 'deciduous', // 落葉樹
    Evergreen: 'evergreen', // 常緑樹
    Conifer: 'conifer', // 針葉樹
    PalmLike: 'palmLike', // ヤシ類
    Shrub: 'shrub', // 低木・生垣
};
/** Tree health / vitality status */
export const TreeHealthStatus = {
    Healthy: 'healthy', // 健全
    Declining: 'declining', // 衰弱
    Hazardous: 'hazardous', // 危険（倒木リスク）
    Dead: 'dead', // 枯死
    Removed: 'removed', // 撤去済み
};
// ---- RFI追加: 公園施設 (Park Facility) ----
/**
 * Park facility type classification
 * Based on Nagoya 公園管理システム subsystem requirements
 */
export const ParkFacilityCategory = {
    Toilet: 'toilet', // 公衆トイレ
    Playground: 'playground', // 遊具
    Bench: 'bench', // ベンチ
    Shelter: 'shelter', // 東屋・あずまや
    Fence: 'fence', // フェンス・柵
    Gate: 'gate', // 門・出入口
    Drainage: 'drainage', // 排水設備
    Lighting: 'lighting', // 園内照明
    WaterFountain: 'waterFountain', // 水飲み場
    SignBoard: 'signBoard', // 案内看板
    Pavement: 'pavement', // 園路舗装
    SportsFacility: 'sportsFacility', // 運動施設
    Building: 'building', // 管理棟・倉庫
    Other: 'other', // その他
};
/** Facility condition grade (劣化度) */
export const ConditionGrade = {
    A: 'A', // 健全（問題なし）
    B: 'B', // 軽微な劣化
    C: 'C', // 要補修
    D: 'D', // 要改築・撤去
    S: 'S', // 緊急対応
};
// ---- RFI追加: 道路舗装 (Pavement) ----
/** Pavement surface type */
export const PavementType = {
    Asphalt: 'asphalt', // アスファルト
    Concrete: 'concrete', // コンクリート
    Interlocking: 'interlocking', // インターロッキング
    Gravel: 'gravel', // 砂利
    Other: 'other',
};
// ---- RFI追加: ポンプ施設 (Pump Station) ----
/** Pump station type classification */
export const PumpStationCategory = {
    Stormwater: 'stormwater', // 雨水ポンプ
    Sewage: 'sewage', // 汚水ポンプ
    Irrigation: 'irrigation', // 灌漑ポンプ
    Combined: 'combined', // 合流式ポンプ
};
/** Pump equipment status */
export const PumpEquipmentStatus = {
    Operational: 'operational', // 稼働中
    Standby: 'standby', // 待機
    UnderMaintenance: 'underMaintenance', // 整備中
    OutOfService: 'outOfService', // 運用停止
};
// ---- RFI追加: 点検・診断 (Inspection) ----
/** Inspection type */
export const InspectionType = {
    Routine: 'routine', // 定期点検
    Detailed: 'detailed', // 詳細点検
    Emergency: 'emergency', // 緊急点検
    Diagnostic: 'diagnostic', // 診断調査
};
/** Inspection result summary */
export const InspectionResult = {
    Pass: 'pass', // 合格・問題なし
    Minor: 'minor', // 軽微な異常
    NeedsRepair: 'needsRepair', // 要補修
    Critical: 'critical', // 要緊急対応
};
// ---- RFI追加: 長寿命化計画 (Lifecycle Plan) ----
/** Lifecycle plan intervention type */
export const InterventionType = {
    Repair: 'repair', // 補修
    Renewal: 'renewal', // 更新
    Replacement: 'replacement', // 取替
    Removal: 'removal', // 撤去
};
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
