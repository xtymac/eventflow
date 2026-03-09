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
    unitCode?: string;
    datasetId?: URI;
}
/**
 * NGSI-LD Relationship — links one entity to another
 * @see ETSI GS CIM 009 §4.5.3
 */
export interface Relationship {
    type: 'Relationship';
    object: URI | URI[];
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
    id: URI;
    type: string;
    '@context': string | string[];
    createdAt?: DateTime;
    modifiedAt?: DateTime;
}
/**
 * The project @context resolves short property names to full URIs.
 * At runtime, entities reference this via:
 *   "@context": [
 *     "https://nagoya-construction.example.org/ngsi-ld/v1/context.jsonld",
 *     "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"
 *   ]
 */
export declare const NAGOYA_CONTEXT: "https://nagoya-construction.example.org/ngsi-ld/v1/context.jsonld";
export declare const NGSI_LD_CORE_CONTEXT: "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld";
export declare const DEFAULT_CONTEXT: string[];
/** Entity type URN prefixes following NGSI-LD convention */
export declare const EntityTypePrefix: {
    readonly CivicOperation: "urn:ngsi-ld:CivicOperation:";
    readonly WorkOrder: "urn:ngsi-ld:WorkOrder:";
    readonly Road: "urn:ngsi-ld:Road:";
    readonly RoadSegment: "urn:ngsi-ld:RoadSegment:";
    readonly GreenSpace: "urn:ngsi-ld:GreenSpace:";
    readonly Streetlight: "urn:ngsi-ld:Streetlight:";
    readonly WaterBody: "urn:ngsi-ld:WaterBody:";
    readonly Evidence: "urn:ngsi-ld:Evidence:";
    readonly Organization: "urn:ngsi-ld:Organization:";
    readonly DesignatedRoad: "urn:ngsi-ld:DesignatedRoad:";
    readonly BuildingZone: "urn:ngsi-ld:BuildingZone:";
    readonly StreetTree: "urn:ngsi-ld:StreetTree:";
    readonly ParkFacility: "urn:ngsi-ld:ParkFacility:";
    readonly PavementSection: "urn:ngsi-ld:PavementSection:";
    readonly PumpStation: "urn:ngsi-ld:PumpStation:";
    readonly InspectionRecord: "urn:ngsi-ld:InspectionRecord:";
    readonly LifecyclePlan: "urn:ngsi-ld:LifecyclePlan:";
};
export type EntityType = keyof typeof EntityTypePrefix;
/** Build a NGSI-LD entity URN from type and local ID */
export declare function entityId(type: EntityType, localId: string): URI;
/**
 * CivicOperation status lifecycle
 * Extends BuildingOperation.status with municipal governance stages
 * @see dataModel.Building/BuildingOperation → status
 */
export declare const CivicOperationStatus: {
    readonly Planned: "planned";
    readonly Scheduled: "scheduled";
    readonly Ongoing: "ongoing";
    readonly PendingReview: "pendingReview";
    readonly Finished: "finished";
    readonly Archived: "archived";
    readonly Cancelled: "cancelled";
};
export type CivicOperationStatusType = typeof CivicOperationStatus[keyof typeof CivicOperationStatus];
/** Work zone restriction types */
export declare const RestrictionCategory: {
    readonly Full: "fullClosure";
    readonly Partial: "partialClosure";
    readonly WorkZone: "workZone";
};
export type RestrictionCategoryType = typeof RestrictionCategory[keyof typeof RestrictionCategory];
/** Post-end decision after operation completes */
export declare const PostEndDecision: {
    readonly Pending: "pending";
    readonly NoChange: "noChange";
    readonly PermanentChange: "permanentChange";
};
export type PostEndDecisionType = typeof PostEndDecision[keyof typeof PostEndDecision];
/**
 * WorkOrder operation types
 * @see dataModel.IssueTracking/IssueReporting → category
 */
export declare const WorkOrderCategory: {
    readonly Inspection: "inspection";
    readonly Repair: "repair";
    readonly Update: "update";
};
export type WorkOrderCategoryType = typeof WorkOrderCategory[keyof typeof WorkOrderCategory];
/**
 * WorkOrder resolution status
 * @see dataModel.IssueTracking/IssueReporting → resolutionStatus
 */
export declare const WorkOrderResolutionStatus: {
    readonly Open: "open";
    readonly Assigned: "assigned";
    readonly InProgress: "inProgress";
    readonly Closed: "closed";
    readonly Cancelled: "cancelled";
};
export type WorkOrderResolutionStatusType = typeof WorkOrderResolutionStatus[keyof typeof WorkOrderResolutionStatus];
/**
 * Road classification
 * @see dataModel.Transportation/Road → roadClass
 */
export declare const RoadClass: {
    readonly Motorway: "motorway";
    readonly Trunk: "trunk";
    readonly Primary: "primary";
    readonly Secondary: "secondary";
    readonly Tertiary: "tertiary";
    readonly Residential: "residential";
    readonly Service: "service";
    readonly Unclassified: "unclassified";
    readonly Arterial: "arterial";
    readonly Collector: "collector";
    readonly Local: "local";
};
export type RoadClassType = typeof RoadClass[keyof typeof RoadClass];
/**
 * Green space category
 * @see dataModel.ParksAndGardens/Garden → category
 */
export declare const GreenSpaceCategory: {
    readonly Park: "park";
    readonly Garden: "garden";
    readonly Grass: "grass";
    readonly Forest: "forest";
    readonly Meadow: "meadow";
    readonly Playground: "playground";
    readonly Botanical: "botanical";
    readonly Community: "community";
    readonly Public: "public";
};
export type GreenSpaceCategoryType = typeof GreenSpaceCategory[keyof typeof GreenSpaceCategory];
/**
 * Streetlight lamp technology
 * @see dataModel.Streetlighting/Streetlight → lampTechnology
 */
export declare const LampTechnology: {
    readonly LED: "LED";
    readonly LPS: "LPS";
    readonly HPS: "HPS";
    readonly MercuryVapor: "mercuryVapor";
    readonly Fluorescent: "fluorescent";
    readonly Halogen: "halogen";
};
export type LampTechnologyType = typeof LampTechnology[keyof typeof LampTechnology];
/** Streetlight operational status */
export declare const StreetlightStatus: {
    readonly Ok: "ok";
    readonly Defective: "defective";
    readonly UnderMaintenance: "underMaintenance";
    readonly Damaged: "damaged";
    readonly Replaced: "replaced";
};
export type StreetlightStatusType = typeof StreetlightStatus[keyof typeof StreetlightStatus];
/** Waterway classification */
export declare const WaterwayCategory: {
    readonly River: "river";
    readonly Stream: "stream";
    readonly Canal: "canal";
    readonly Drain: "drain";
};
export type WaterwayCategoryType = typeof WaterwayCategory[keyof typeof WaterwayCategory];
/** Evidence media type */
export declare const EvidenceMediaType: {
    readonly Photo: "photo";
    readonly Document: "document";
    readonly Report: "report";
    readonly CAD: "cad";
    readonly Other: "other";
};
export type EvidenceMediaTypeValue = typeof EvidenceMediaType[keyof typeof EvidenceMediaType];
/** Evidence review status (workflow: pending -> approved/rejected -> accepted_by_authority) */
export declare const EvidenceReviewStatus: {
    readonly Pending: "pending";
    readonly Approved: "approved";
    readonly Rejected: "rejected";
    readonly AcceptedByAuthority: "accepted_by_authority";
};
export type EvidenceReviewStatusType = typeof EvidenceReviewStatus[keyof typeof EvidenceReviewStatus];
/** Evidence submitter role */
export declare const EvidenceSubmitterRole: {
    readonly Partner: "partner";
    readonly GovInspector: "gov_inspector";
};
export type EvidenceSubmitterRoleType = typeof EvidenceSubmitterRole[keyof typeof EvidenceSubmitterRole];
/** Partner (contractor) role in a WorkOrder */
export declare const PartnerRole: {
    readonly Contractor: "contractor";
    readonly Inspector: "inspector";
    readonly Reviewer: "reviewer";
};
export type PartnerRoleType = typeof PartnerRole[keyof typeof PartnerRole];
/** Asset data lifecycle status */
export declare const AssetLifecycleStatus: {
    readonly Active: "active";
    readonly Inactive: "inactive";
    readonly Retired: "retired";
    readonly Removed: "removed";
};
export type AssetLifecycleStatusType = typeof AssetLifecycleStatus[keyof typeof AssetLifecycleStatus];
/** Data provenance source */
export declare const DataProvenance: {
    readonly OsmTest: "osm_test";
    readonly OfficialLedger: "official_ledger";
    readonly Manual: "manual";
    readonly MvtSync: "mvt_sync";
};
export type DataProvenanceType = typeof DataProvenance[keyof typeof DataProvenance];
/** Administrative management level */
export declare const ManagementLevel: {
    readonly National: "national";
    readonly Prefectural: "prefectural";
    readonly Municipal: "municipal";
};
export type ManagementLevelType = typeof ManagementLevel[keyof typeof ManagementLevel];
/** Tree species classification */
export declare const TreeCategory: {
    readonly Deciduous: "deciduous";
    readonly Evergreen: "evergreen";
    readonly Conifer: "conifer";
    readonly PalmLike: "palmLike";
    readonly Shrub: "shrub";
};
export type TreeCategoryType = typeof TreeCategory[keyof typeof TreeCategory];
/** Tree health / vitality status */
export declare const TreeHealthStatus: {
    readonly Healthy: "healthy";
    readonly Declining: "declining";
    readonly Hazardous: "hazardous";
    readonly Dead: "dead";
    readonly Removed: "removed";
};
export type TreeHealthStatusType = typeof TreeHealthStatus[keyof typeof TreeHealthStatus];
/**
 * Park facility type classification
 * Based on Nagoya 公園管理システム subsystem requirements
 */
export declare const ParkFacilityCategory: {
    readonly Toilet: "toilet";
    readonly Playground: "playground";
    readonly Bench: "bench";
    readonly Shelter: "shelter";
    readonly Fence: "fence";
    readonly Gate: "gate";
    readonly Drainage: "drainage";
    readonly Lighting: "lighting";
    readonly WaterFountain: "waterFountain";
    readonly SignBoard: "signBoard";
    readonly Pavement: "pavement";
    readonly SportsFacility: "sportsFacility";
    readonly Building: "building";
    readonly Other: "other";
};
export type ParkFacilityCategoryType = typeof ParkFacilityCategory[keyof typeof ParkFacilityCategory];
/** Facility condition grade (劣化度) */
export declare const ConditionGrade: {
    readonly A: "A";
    readonly B: "B";
    readonly C: "C";
    readonly D: "D";
    readonly S: "S";
};
export type ConditionGradeType = typeof ConditionGrade[keyof typeof ConditionGrade];
/** Pavement surface type */
export declare const PavementType: {
    readonly Asphalt: "asphalt";
    readonly Concrete: "concrete";
    readonly Interlocking: "interlocking";
    readonly Gravel: "gravel";
    readonly Other: "other";
};
export type PavementTypeValue = typeof PavementType[keyof typeof PavementType];
/** Pump station type classification */
export declare const PumpStationCategory: {
    readonly Stormwater: "stormwater";
    readonly Sewage: "sewage";
    readonly Irrigation: "irrigation";
    readonly Combined: "combined";
};
export type PumpStationCategoryType = typeof PumpStationCategory[keyof typeof PumpStationCategory];
/** Pump equipment status */
export declare const PumpEquipmentStatus: {
    readonly Operational: "operational";
    readonly Standby: "standby";
    readonly UnderMaintenance: "underMaintenance";
    readonly OutOfService: "outOfService";
};
export type PumpEquipmentStatusType = typeof PumpEquipmentStatus[keyof typeof PumpEquipmentStatus];
/** Inspection type */
export declare const InspectionType: {
    readonly Routine: "routine";
    readonly Detailed: "detailed";
    readonly Emergency: "emergency";
    readonly Diagnostic: "diagnostic";
};
export type InspectionTypeValue = typeof InspectionType[keyof typeof InspectionType];
/** Inspection result summary */
export declare const InspectionResult: {
    readonly Pass: "pass";
    readonly Minor: "minor";
    readonly NeedsRepair: "needsRepair";
    readonly Critical: "critical";
};
export type InspectionResultType = typeof InspectionResult[keyof typeof InspectionResult];
/** Lifecycle plan intervention type */
export declare const InterventionType: {
    readonly Repair: "repair";
    readonly Renewal: "renewal";
    readonly Replacement: "replacement";
    readonly Removal: "removal";
};
export type InterventionTypeValue = typeof InterventionType[keyof typeof InterventionType];
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
    /** Operation boundary polygon */
    location: GeoProperty<Polygon | MultiPolygon>;
    /** How geometry was derived: manual draw or auto-buffer */
    geometrySource?: Property<'manual' | 'auto'>;
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
    /** Related road assets affected by this operation */
    refAffectedAsset?: Relationship;
    /** WorkOrders spawned from this operation */
    refWorkOrder?: Relationship;
    /** Reference to a specific asset this operation is related to (singular) */
    refAsset?: Relationship;
    dataProvider?: Property<string>;
    source?: Property<string>;
}
/**
 * WorkOrder — A specific task (inspection, repair, update) assigned
 * to a department or contractor under a CivicOperation.
 *
 * FIWARE base: IssueReporting
 * Extension: Adds multi-location, multi-partner, evidence review gate
 */
export interface WorkOrder extends NgsiLdEntity {
    type: 'WorkOrder';
    /** Task title */
    title: Property<string>;
    /** Detailed description */
    description?: Property<string>;
    /** Work category (inspection, repair, update) */
    category: Property<WorkOrderCategoryType>;
    /** Current resolution status */
    resolutionStatus: Property<WorkOrderResolutionStatusType>;
    /** Department responsible for execution */
    assignedDepartment?: Property<string>;
    /** Person/role who made the assignment */
    assignedBy?: Property<string>;
    /** Timestamp of assignment */
    assignedAt?: Property<DateTime>;
    /** Deadline for completion */
    dueDate?: Property<DateTime>;
    /** Actual start timestamp */
    dateStarted?: Property<DateTime>;
    /** Actual completion timestamp */
    dateFinished?: Property<DateTime>;
    /** Person who reviewed the completed work */
    reviewedBy?: Property<string>;
    /** Review timestamp */
    reviewedAt?: Property<DateTime>;
    /** Review notes */
    reviewNotes?: Property<string>;
    /** Parent CivicOperation (required) */
    refCivicOperation: Relationship;
    /** Associated work locations with geometry */
    refWorkLocation?: Relationship;
    /** Assigned partners/contractors */
    refPartner?: Relationship;
    /** Attached evidence items */
    refEvidence?: Relationship;
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
    /** WorkOrder(s) this partner is assigned to */
    refWorkOrder: Relationship;
}
/**
 * Road — A logical road entity composed of one or more RoadSegments.
 *
 * FIWARE base: Road
 * Extension: Adds Japanese name fields, data provenance, OSM sync tracking,
 *            Nagoya municipal designation fields
 */
export interface Road extends NgsiLdEntity {
    type: 'Road';
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
    /** Road centerline or polygon geometry */
    location: GeoProperty<LineString | Polygon>;
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
    /** Source of the name: osm, municipal, manual, google */
    nameSource?: Property<string>;
    /** Name match confidence level */
    nameConfidence?: Property<string>;
    /** Data source identifier */
    dataProvider?: Property<DataProvenanceType>;
    /** Source dataset version */
    sourceVersion?: Property<string>;
    /** Source dataset date */
    sourceDate?: Property<DateTime>;
    /** Last verification timestamp */
    lastVerifiedAt?: Property<DateTime>;
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
    /** Segments composing this road */
    refRoadSegment?: Relationship;
    /** Replacement road (for retired roads) */
    refReplacedBy?: Relationship;
}
/**
 * GreenSpace — A park, garden, or green area in the municipality.
 *
 * FIWARE base: Garden
 * Extension: Adds OSM-specific type tags, area calculation, vegetation classification
 */
export interface GreenSpace extends NgsiLdEntity {
    type: 'GreenSpace';
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
    /** Boundary polygon */
    location: GeoProperty<Polygon>;
    /** Area in square meters */
    areaServed?: Property<number>;
    /** OSM leisure tag */
    leisureType?: Property<string>;
    /** OSM landuse tag */
    landuseType?: Property<string>;
    /** OSM natural tag */
    naturalType?: Property<string>;
    /** Vegetation type classification */
    vegetationType?: Property<string>;
    /** Data lifecycle status */
    status: Property<AssetLifecycleStatusType>;
    /** Governance-level condition assessment */
    condition?: Property<string>;
    /** Governance-level risk level */
    riskLevel?: Property<string>;
    /** Ward / district */
    ward?: Property<string>;
    dataProvider?: Property<DataProvenanceType>;
    sourceVersion?: Property<string>;
    sourceDate?: Property<DateTime>;
    lastVerifiedAt?: Property<DateTime>;
    osmType?: Property<string>;
    osmId?: Property<number>;
    osmTimestamp?: Property<DateTime>;
    lastSyncedAt?: Property<DateTime>;
    isManuallyEdited?: Property<boolean>;
}
/**
 * Streetlight — A public lighting fixture on municipal infrastructure.
 *
 * FIWARE base: Streetlight
 * Extension: Adds equipment-level lamp status, road reference
 */
export interface Streetlight extends NgsiLdEntity {
    type: 'Streetlight';
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
    /** Fixture location point */
    location: GeoProperty<Point>;
    /** Data lifecycle status */
    status: Property<AssetLifecycleStatusType>;
    /** Governance-level condition assessment */
    condition?: Property<string>;
    /** Governance-level risk level */
    riskLevel?: Property<string>;
    /** Ward / district */
    ward?: Property<string>;
    /** Road where this light is located */
    refRoad?: Relationship;
    dataProvider?: Property<DataProvenanceType>;
    sourceVersion?: Property<string>;
    sourceDate?: Property<DateTime>;
    lastVerifiedAt?: Property<DateTime>;
    osmType?: Property<string>;
    osmId?: Property<number>;
    osmTimestamp?: Property<DateTime>;
    lastSyncedAt?: Property<DateTime>;
    isManuallyEdited?: Property<boolean>;
}
/**
 * WaterBody — A river, stream, canal, or other waterway in the municipality.
 *
 * Custom entity following NGSI-LD patterns.
 * No direct FIWARE Smart Data Model; uses common geographic + provenance patterns.
 */
export interface WaterBody extends NgsiLdEntity {
    type: 'WaterBody';
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
    /** Centerline (LineString) or water body extent (Polygon) */
    location: GeoProperty<LineString | Polygon>;
    /** Geometry representation type (line vs polygon) */
    geometryRepresentation: Property<'line' | 'polygon' | 'collection'>;
    /** Data lifecycle status */
    status: Property<AssetLifecycleStatusType>;
    /** Governance-level condition assessment */
    condition?: Property<string>;
    /** Governance-level risk level */
    riskLevel?: Property<string>;
    /** Ward / district */
    ward?: Property<string>;
    dataProvider?: Property<DataProvenanceType>;
    sourceVersion?: Property<string>;
    sourceDate?: Property<DateTime>;
    lastVerifiedAt?: Property<DateTime>;
    osmType?: Property<string>;
    osmId?: Property<number>;
    osmTimestamp?: Property<DateTime>;
    lastSyncedAt?: Property<DateTime>;
    isManuallyEdited?: Property<boolean>;
}
/**
 * Evidence — A photo, document, report, or CAD file attached to a WorkOrder
 * as proof of work completion or site condition documentation.
 *
 * Custom entity following NGSI-LD patterns.
 */
export interface Evidence extends NgsiLdEntity {
    type: 'Evidence';
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
    /** Geotagged capture location */
    location?: GeoProperty<Point>;
    /** Person who submitted the evidence */
    submittedBy: Property<string>;
    /** Submission timestamp */
    submittedAt: Property<DateTime>;
    /** Partner ID who submitted (from X-Partner-Id header) */
    submitterPartnerId?: Property<string>;
    /** Role of submitter: partner or gov_inspector */
    submitterRole?: Property<EvidenceSubmitterRoleType>;
    /** Current review status */
    reviewStatus: Property<EvidenceReviewStatusType>;
    /** Reviewer identity */
    reviewedBy?: Property<string>;
    /** Review timestamp */
    reviewedAt?: Property<DateTime>;
    /** Review notes / rejection reason */
    reviewNotes?: Property<string>;
    /** Government role who made final decision */
    decisionBy?: Property<string>;
    /** Decision timestamp */
    decisionAt?: Property<DateTime>;
    /** Decision notes / reason */
    decisionNotes?: Property<string>;
    /** Parent WorkOrder */
    refWorkOrder: Relationship;
}
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
    /** Road geometry (typically LineString) */
    location: GeoProperty<LineString>;
    /** Sync timestamp */
    syncedAt: Property<DateTime>;
}
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
    /** Zone boundary polygon */
    location: GeoProperty<Polygon>;
    /** Sync timestamp */
    syncedAt: Property<DateTime>;
}
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
    /** Current health status (健全度) */
    healthStatus: Property<TreeHealthStatusType>;
    /** Condition grade from last inspection (劣化度) */
    conditionGrade?: Property<ConditionGradeType>;
    /** Last diagnostic date */
    lastDiagnosticDate?: Property<DateTime>;
    /** Diagnostic notes */
    diagnosticNotes?: Property<string>;
    /** Tree location point */
    location: GeoProperty<Point>;
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
    /** Road where this tree is planted */
    refRoad?: Relationship;
    /** Park/greenspace if within a park */
    refGreenSpace?: Relationship;
    /** Related inspection records */
    refInspectionRecord?: Relationship;
    /** Related lifecycle plan */
    refLifecyclePlan?: Relationship;
    dataProvider?: Property<DataProvenanceType>;
    sourceVersion?: Property<string>;
    sourceDate?: Property<DateTime>;
    lastVerifiedAt?: Property<DateTime>;
    osmType?: Property<string>;
    osmId?: Property<number>;
}
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
    /** Current condition grade (劣化度) */
    conditionGrade?: Property<ConditionGradeType>;
    /** Last inspection date */
    lastInspectionDate?: Property<DateTime>;
    /** Next scheduled inspection */
    nextInspectionDate?: Property<DateTime>;
    /** Safety concern flag */
    safetyConcern?: Property<boolean>;
    /** Facility location (point or polygon) */
    location: GeoProperty<Point | Polygon>;
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
    /** Parent park / green space */
    refGreenSpace: Relationship;
    /** Related inspection records */
    refInspectionRecord?: Relationship;
    /** Related lifecycle plan */
    refLifecyclePlan?: Relationship;
    dataProvider?: Property<DataProvenanceType>;
    sourceVersion?: Property<string>;
    lastVerifiedAt?: Property<DateTime>;
}
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
    /** Section management ID (区間管理番号) */
    sectionId?: Property<string>;
    /** Section name or route designation */
    name?: Property<string>;
    /** Road route number (路線番号) */
    routeNumber?: Property<string>;
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
    /** Planned year for next repair/renewal (計画年度) */
    plannedInterventionYear?: Property<number>;
    /** Estimated repair cost in JPY (概算費用) */
    estimatedCost?: Property<number>;
    /** Priority ranking for 5-year plan */
    priorityRank?: Property<number>;
    /** Pavement section geometry (typically LineString along road centerline) */
    location: GeoProperty<LineString | Polygon>;
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
    /** Parent road */
    refRoad: Relationship;
    /** Related inspection records */
    refInspectionRecord?: Relationship;
    /** Related lifecycle plan */
    refLifecyclePlan?: Relationship;
    dataProvider?: Property<DataProvenanceType>;
    sourceVersion?: Property<string>;
    lastVerifiedAt?: Property<DateTime>;
}
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
    /** Station management ID (施設管理番号) */
    stationId?: Property<string>;
    /** Station name */
    name: Property<string>;
    /** Free-text description */
    description?: Property<string>;
    /** Station type classification */
    category: Property<PumpStationCategoryType>;
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
    /** Overall station equipment status */
    equipmentStatus: Property<PumpEquipmentStatusType>;
    /** Condition grade from latest assessment */
    conditionGrade?: Property<ConditionGradeType>;
    /** Last maintenance date */
    lastMaintenanceDate?: Property<DateTime>;
    /** Next scheduled maintenance */
    nextMaintenanceDate?: Property<DateTime>;
    /** Station location (point or polygon for compound) */
    location: GeoProperty<Point | Polygon>;
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
    /** Related water body (river/canal being pumped) */
    refWaterBody?: Relationship;
    /** Related inspection records */
    refInspectionRecord?: Relationship;
    /** Related lifecycle plan */
    refLifecyclePlan?: Relationship;
    dataProvider?: Property<DataProvenanceType>;
    sourceVersion?: Property<string>;
    lastVerifiedAt?: Property<DateTime>;
}
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
    /** Inspector name or organization */
    inspector?: Property<string>;
    /** Inspector affiliation */
    inspectorOrganization?: Property<string>;
    /** Raw measurement data (JSONB-like flexible structure) */
    measurements?: Property<Record<string, unknown>>;
    /** Inspection location */
    location?: GeoProperty<Point | Polygon>;
    /** Photo URLs or references */
    mediaUrls?: Property<string[]>;
    /** Inspected asset (any entity type) */
    refInspectedAsset: Relationship;
    /** Parent CivicOperation (if inspection was part of an event) */
    refCivicOperation?: Relationship;
    /** Parent WorkOrder (if inspection was a work order task) */
    refWorkOrder?: Relationship;
    /** Attached evidence items */
    refEvidence?: Relationship;
    dataProvider?: Property<DataProvenanceType>;
}
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
    /** Asset type being planned (e.g. 'ParkFacility', 'PavementSection') */
    assetType: Property<string>;
    /** Current condition grade at plan creation */
    baselineCondition?: Property<ConditionGradeType>;
    /** Design service life in years */
    designLife?: Property<number>;
    /** Remaining service life in years */
    remainingLife?: Property<number>;
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
    /** Target asset this plan covers */
    refAsset: Relationship;
    /** Related inspection records informing the plan */
    refInspectionRecord?: Relationship;
    /** Responsible department */
    managingDept?: Property<string>;
    /** Plan author */
    createdBy?: Property<string>;
    /** Approval date */
    approvedAt?: Property<DateTime>;
    dataProvider?: Property<DataProvenanceType>;
}
/** All NGSI-LD entities in the Nagoya domain */
export type NagoyaEntity = CivicOperation | WorkOrder | WorkLocation | Partner | Road | GreenSpace | Streetlight | WaterBody | Evidence | DesignatedRoad | BuildingZone | StreetTree | ParkFacility | PavementSection | PumpStation | InspectionRecord | LifecyclePlan;
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
