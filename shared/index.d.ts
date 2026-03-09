import type { Feature, Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection } from 'geojson';
export type EventStatus = 'planned' | 'active' | 'pending_review' | 'closed' | 'archived' | 'cancelled';
export type RestrictionType = 'full' | 'partial' | 'workzone';
export type PostEndDecision = 'pending' | 'no-change' | 'permanent-change';
export type AssetStatus = 'active' | 'inactive' | 'removed';
export type AssetCondition = 'good' | 'attention' | 'bad' | 'unknown';
export type AssetRiskLevel = 'low' | 'medium' | 'high';
export type RoadType = 'arterial' | 'collector' | 'local';
export type ChangeType = 'create' | 'update' | 'retire';
export type RelationType = 'affected' | 'updated';
export type AssetTypeRef = 'road' | 'river' | 'streetlight' | 'greenspace' | 'street_tree' | 'park_facility' | 'pavement_section' | 'pump_station';
export type GeometrySource = 'manual' | 'auto';
export type NameSource = 'osm' | 'municipal' | 'manual' | 'google';
export type NameConfidence = 'high' | 'medium' | 'low';
export type DataSource = 'osm_test' | 'official_ledger' | 'manual';
export type OsmType = 'node' | 'way' | 'relation';
export type RiverGeometryType = 'line' | 'polygon' | 'collection';
export type WaterwayType = 'river' | 'stream' | 'canal' | 'drain';
export type WaterType = 'river' | 'pond' | 'lake';
export type ManagementLevel = 'national' | 'prefectural' | 'municipal';
export type GreenSpaceType = 'park' | 'garden' | 'grass' | 'forest' | 'meadow' | 'playground';
export type VegetationType = 'trees' | 'grass' | 'mixed' | 'flower_beds' | 'shrubs';
export type LampType = 'led' | 'sodium' | 'mercury' | 'fluorescent' | 'halogen';
export type LampStatus = 'operational' | 'maintenance' | 'damaged' | 'replaced';
export type TreeCategory = 'deciduous' | 'evergreen' | 'conifer' | 'palmLike' | 'shrub';
export type TreeHealthStatus = 'healthy' | 'declining' | 'hazardous' | 'dead' | 'removed';
export type ConditionGrade = 'A' | 'B' | 'C' | 'D' | 'S';
export type ParkFacilityCategory = 'toilet' | 'playground' | 'bench' | 'shelter' | 'fence' | 'gate' | 'drainage' | 'lighting' | 'waterFountain' | 'signBoard' | 'pavement' | 'sportsFacility' | 'building' | 'other';
export type PavementType = 'asphalt' | 'concrete' | 'interlocking' | 'gravel' | 'other';
export type PumpStationCategory = 'stormwater' | 'sewage' | 'irrigation' | 'combined';
export type PumpEquipmentStatus = 'operational' | 'standby' | 'underMaintenance' | 'outOfService';
export type InspectionResult = 'pass' | 'minor' | 'needsRepair' | 'critical';
export type LifecyclePlanStatus = 'draft' | 'approved' | 'active' | 'archived';
export type InterventionType = 'repair' | 'renewal' | 'replacement' | 'removal';
export type SupportedGeometry = Point | LineString | Polygon | MultiPoint | MultiLineString | MultiPolygon | GeometryCollection;
export type EditableGeometry = Point | LineString | Polygon;
export interface ConstructionEvent {
    id: string;
    name: string;
    status: EventStatus;
    startDate: string;
    endDate: string;
    restrictionType: RestrictionType;
    geometry: SupportedGeometry;
    geometrySource?: GeometrySource;
    postEndDecision: PostEndDecision;
    archivedAt?: string | null;
    roadAssets?: RoadAsset[];
    department: string;
    ward?: string;
    createdBy?: string;
    closedBy?: string;
    closedAt?: string | null;
    closeNotes?: string | null;
    refAssetId?: string | null;
    refAssetType?: AssetTypeRef | null;
    workOrders?: WorkOrder[];
    updatedAt: string;
}
export interface DataSourceTracking {
    dataSource?: DataSource;
    sourceVersion?: string;
    sourceDate?: string;
    lastVerifiedAt?: string;
}
export interface OsmTracking {
    osmType?: OsmType;
    osmId?: string;
    osmTimestamp?: string;
    lastSyncedAt?: string;
    isManuallyEdited?: boolean;
}
export interface RoadAsset extends DataSourceTracking, OsmTracking {
    id: string;
    name?: string;
    nameJa?: string;
    ref?: string;
    localRef?: string;
    displayName?: string;
    nameSource?: NameSource;
    nameConfidence?: NameConfidence;
    geometry: SupportedGeometry;
    roadType: RoadType;
    lanes: number;
    direction: string;
    status: AssetStatus;
    condition?: AssetCondition;
    riskLevel?: AssetRiskLevel;
    validFrom: string;
    validTo?: string;
    replacedBy?: string;
    ownerDepartment?: string;
    ward?: string;
    landmark?: string;
    sublocality?: string;
    crossSection?: string;
    managingDept?: string;
    intersection?: string;
    pavementState?: string;
    updatedAt: string;
}
export interface RiverAsset extends DataSourceTracking, OsmTracking {
    id: string;
    name?: string;
    nameJa?: string;
    displayName?: string;
    geometry: SupportedGeometry;
    geometryType: RiverGeometryType;
    waterwayType?: WaterwayType;
    waterType?: WaterType;
    width?: number;
    managementLevel?: ManagementLevel;
    maintainer?: string;
    status: AssetStatus;
    condition?: AssetCondition;
    riskLevel?: AssetRiskLevel;
    ward?: string;
    updatedAt: string;
}
export interface GreenSpaceAsset extends DataSourceTracking, OsmTracking {
    id: string;
    name?: string;
    nameJa?: string;
    displayName?: string;
    geometry: Polygon;
    greenSpaceType: GreenSpaceType;
    leisureType?: string;
    landuseType?: string;
    naturalType?: string;
    areaM2?: number;
    vegetationType?: VegetationType;
    operator?: string;
    status: AssetStatus;
    condition?: AssetCondition;
    riskLevel?: AssetRiskLevel;
    ward?: string;
    updatedAt: string;
}
export interface StreetLightAsset extends DataSourceTracking, OsmTracking {
    id: string;
    lampId?: string;
    displayName?: string;
    geometry: Point;
    lampType: LampType;
    wattage?: number;
    installDate?: string;
    lampStatus: LampStatus;
    roadRef?: string;
    status: AssetStatus;
    condition?: AssetCondition;
    riskLevel?: AssetRiskLevel;
    ward?: string;
    updatedAt: string;
}
export interface StreetTreeAsset extends DataSourceTracking {
    id: string;
    ledgerId?: string;
    displayName?: string;
    speciesName?: string;
    scientificName?: string;
    category: TreeCategory;
    trunkDiameter?: number;
    height?: number;
    crownSpread?: number;
    datePlanted?: string;
    estimatedAge?: number;
    healthStatus: TreeHealthStatus;
    conditionGrade?: ConditionGrade;
    lastDiagnosticDate?: string;
    diagnosticNotes?: string;
    geometry: Point;
    status: AssetStatus;
    condition?: AssetCondition;
    riskLevel?: AssetRiskLevel;
    ward?: string;
    managingDept?: string;
    roadRef?: string;
    greenSpaceRef?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ParkFacilityAsset extends DataSourceTracking {
    id: string;
    facilityId?: string;
    name: string;
    description?: string;
    category: ParkFacilityCategory;
    subCategory?: string;
    dateInstalled?: string;
    manufacturer?: string;
    material?: string;
    quantity?: number;
    designLife?: number;
    conditionGrade?: ConditionGrade;
    lastInspectionDate?: string;
    nextInspectionDate?: string;
    safetyConcern?: boolean;
    geometry: SupportedGeometry;
    status: AssetStatus;
    condition?: AssetCondition;
    riskLevel?: AssetRiskLevel;
    ward?: string;
    managingDept?: string;
    greenSpaceRef: string;
    createdAt: string;
    updatedAt: string;
}
export interface PavementSectionAsset extends DataSourceTracking {
    id: string;
    sectionId?: string;
    name?: string;
    routeNumber?: string;
    pavementType: PavementType;
    length?: number;
    width?: number;
    thickness?: number;
    lastResurfacingDate?: string;
    mci?: number;
    crackRate?: number;
    rutDepth?: number;
    iri?: number;
    lastMeasurementDate?: string;
    plannedInterventionYear?: number;
    estimatedCost?: number;
    priorityRank?: number;
    geometry: SupportedGeometry;
    status: AssetStatus;
    condition?: AssetCondition;
    riskLevel?: AssetRiskLevel;
    ward?: string;
    managingDept?: string;
    roadRef: string;
    createdAt: string;
    updatedAt: string;
}
export interface PumpStationAsset extends DataSourceTracking {
    id: string;
    stationId?: string;
    name: string;
    description?: string;
    category: PumpStationCategory;
    dateCommissioned?: string;
    designCapacity?: number;
    pumpCount?: number;
    totalPower?: number;
    drainageArea?: number;
    equipmentStatus: PumpEquipmentStatus;
    conditionGrade?: ConditionGrade;
    lastMaintenanceDate?: string;
    nextMaintenanceDate?: string;
    geometry: SupportedGeometry;
    status: AssetStatus;
    condition?: AssetCondition;
    riskLevel?: AssetRiskLevel;
    ward?: string;
    managingDept?: string;
    managingOffice?: string;
    riverRef?: string;
    createdAt: string;
    updatedAt: string;
}
export interface LifecyclePlan {
    id: string;
    title: string;
    version?: string;
    planStartYear: number;
    planEndYear: number;
    planStatus: LifecyclePlanStatus;
    assetType: string;
    baselineCondition?: ConditionGrade;
    designLife?: number;
    remainingLife?: number;
    interventions?: Array<{
        year: number;
        type: InterventionType;
        description?: string;
        estimatedCostJpy: number;
    }>;
    totalLifecycleCostJpy?: number;
    annualAverageCostJpy?: number;
    assetRef?: string;
    managingDept?: string;
    createdBy?: string;
    approvedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface RoadAssetChange {
    id: string;
    eventId: string;
    changeType: ChangeType;
    oldRoadAssetId?: string;
    newRoadAssetId?: string;
    geometry?: SupportedGeometry;
    createdAt: string;
}
export interface InspectionRecord {
    id: string;
    eventId: string | null;
    roadAssetId: string | null;
    assetType?: string | null;
    assetId?: string | null;
    inspectionDate: string;
    result: string;
    conditionGrade?: ConditionGrade | null;
    findings?: string | null;
    notes?: string;
    inspector?: string | null;
    inspectorOrganization?: string | null;
    measurements?: Record<string, unknown> | null;
    mediaUrls?: string[] | null;
    geometry: Point;
    refWorkOrderId?: string | null;
    createdAt: string;
    updatedAt: string;
    status: 'draft' | 'submitted' | 'confirmed' | 'returned';
}
export interface RepairRecord {
    id: string;
    assetType?: string | null;
    assetId?: string | null;
    repairDate: string;
    repairType?: string | null;
    description?: string | null;
    conditionGrade?: string | null;
    mainReplacementParts?: string | null;
    repairNotes?: string | null;
    designDocNumber?: string | null;
    vendor?: string | null;
    measurements?: Record<string, unknown> | null;
    geometry: Point;
    createdAt: string;
    status: 'draft' | 'submitted' | 'confirmed' | 'returned';
}
export type WorkOrderType = 'inspection' | 'repair' | 'update';
export type WorkOrderStatus = 'draft' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type EvidenceType = 'photo' | 'document' | 'report' | 'cad' | 'other';
export type EvidenceReviewStatus = 'pending' | 'approved' | 'rejected' | 'accepted_by_authority';
export type EvidenceSubmitterRole = 'partner' | 'gov_inspector';
export type PartnerRole = 'contractor' | 'inspector' | 'reviewer';
export interface WorkOrder {
    id: string;
    eventId: string;
    type: WorkOrderType;
    title: string;
    description?: string;
    status: WorkOrderStatus;
    assignedDept?: string;
    assignedBy?: string;
    assignedAt?: string;
    dueDate?: string;
    startedAt?: string;
    completedAt?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNotes?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
    locations?: WorkOrderLocation[];
    partners?: WorkOrderPartner[];
    evidence?: Evidence[];
}
export interface WorkOrderLocation {
    id: string;
    workOrderId: string;
    geometry: SupportedGeometry;
    assetType?: string;
    assetId?: string;
    note?: string;
    sequenceOrder: number;
    createdAt: string;
}
export interface WorkOrderPartner {
    workOrderId: string;
    partnerId: string;
    partnerName: string;
    role: PartnerRole;
    assignedAt: string;
}
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
    captureDate?: string;
    geometry?: Point;
    submittedBy: string;
    submittedAt: string;
    submitterPartnerId?: string | null;
    submitterRole?: EvidenceSubmitterRole | null;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewStatus: EvidenceReviewStatus;
    reviewNotes?: string;
    decisionBy?: string | null;
    decisionAt?: string | null;
    decisionNotes?: string | null;
}
export type ConstructionEventFeature = Feature<SupportedGeometry, ConstructionEvent>;
export type RoadAssetFeature = Feature<SupportedGeometry, RoadAsset>;
export type InspectionFeature = Feature<Point, InspectionRecord>;
export type RiverAssetFeature = Feature<SupportedGeometry, RiverAsset>;
export type GreenSpaceAssetFeature = Feature<Polygon, GreenSpaceAsset>;
export type StreetLightAssetFeature = Feature<Point, StreetLightAsset>;
export type StreetTreeAssetFeature = Feature<Point, StreetTreeAsset>;
export type ParkFacilityAssetFeature = Feature<SupportedGeometry, ParkFacilityAsset>;
export type PavementSectionAssetFeature = Feature<SupportedGeometry, PavementSectionAsset>;
export type PumpStationAssetFeature = Feature<SupportedGeometry, PumpStationAsset>;
export type WorkOrderLocationFeature = Feature<SupportedGeometry, WorkOrderLocation & {
    workOrder: Partial<WorkOrder>;
}>;
export interface CreateEventRequest {
    name: string;
    startDate: string;
    endDate: string;
    restrictionType: RestrictionType;
    geometry?: SupportedGeometry;
    department: string;
    ward?: string;
    roadAssetIds: string[];
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
    regenerateGeometry?: boolean;
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
    eventId?: string;
}
export interface UpdateAssetRequest extends Partial<Omit<CreateAssetRequest, 'eventId'>> {
    eventId?: string;
}
export interface RetireAssetRequest {
    eventId: string;
    replacedBy?: string;
}
export interface CreateInspectionRequest {
    eventId?: string;
    roadAssetId?: string;
    inspectionDate: string;
    result: string;
    notes?: string;
    geometry: Point;
}
export interface CreateWorkOrderRequest {
    eventId: string;
    type: WorkOrderType;
    title: string;
    description?: string;
    assignedDept?: string;
    dueDate?: string;
}
export interface UpdateWorkOrderRequest {
    title?: string;
    description?: string;
    assignedDept?: string;
    dueDate?: string;
    reviewNotes?: string;
}
export interface WorkOrderStatusChangeRequest {
    status: WorkOrderStatus;
}
export interface AssignWorkOrderRequest {
    assignedDept: string;
    assignedBy?: string;
}
export interface AddWorkOrderLocationRequest {
    geometry: SupportedGeometry;
    assetType?: string;
    assetId?: string;
    note?: string;
    sequenceOrder?: number;
}
export interface AddWorkOrderPartnerRequest {
    partnerId: string;
    partnerName: string;
    role?: PartnerRole;
}
export interface CreateEvidenceRequest {
    type: EvidenceType;
    title?: string;
    description?: string;
    captureDate?: string;
    geometry?: Point;
}
export interface ReviewEvidenceRequest {
    reviewStatus: 'approved' | 'rejected';
    reviewNotes?: string;
}
export interface MakeEvidenceDecisionRequest {
    decision: 'accepted_by_authority' | 'rejected';
    decisionNotes?: string;
}
export interface EventStatusChangeRequest {
    status: 'active' | 'pending_review';
}
export interface CloseEventRequest {
    closeNotes?: string;
}
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
export interface EvidenceFilters {
    workOrderId?: string;
    type?: EvidenceType | EvidenceType[];
    reviewStatus?: EvidenceReviewStatus | EvidenceReviewStatus[];
    limit?: number;
    offset?: number;
}
export interface EventFilters {
    status?: EventStatus;
    department?: string;
    startDateFrom?: string;
    startDateTo?: string;
    endDateFrom?: string;
    endDateTo?: string;
    name?: string;
    ward?: string;
    includeArchived?: boolean;
}
export interface AssetFilters {
    status?: AssetStatus;
    roadType?: RoadType | RoadType[];
    ownerDepartment?: string;
    ward?: string;
    dataSource?: DataSource | DataSource[];
    q?: string;
    bbox?: string;
    limit?: number;
    offset?: number;
    includeTotal?: boolean;
    unnamed?: boolean;
    filterByMapView?: boolean;
}
export interface RiverFilters {
    status?: AssetStatus;
    waterwayType?: WaterwayType | WaterwayType[];
    geometryType?: RiverGeometryType;
    ward?: string;
    dataSource?: DataSource | DataSource[];
    bbox: string;
    limit?: number;
    offset?: number;
}
export interface GreenSpaceFilters {
    status?: AssetStatus;
    greenSpaceType?: GreenSpaceType | GreenSpaceType[];
    ward?: string;
    dataSource?: DataSource | DataSource[];
    minArea?: number;
    bbox: string;
    limit?: number;
    offset?: number;
}
export interface StreetLightFilters {
    status?: AssetStatus;
    lampType?: LampType | LampType[];
    lampStatus?: LampStatus | LampStatus[];
    ward?: string;
    dataSource?: DataSource | DataSource[];
    bbox: string;
    limit?: number;
    offset?: number;
}
export interface StreetTreeFilters {
    bbox: string;
    category?: TreeCategory | TreeCategory[];
    healthStatus?: TreeHealthStatus | TreeHealthStatus[];
    conditionGrade?: ConditionGrade | ConditionGrade[];
    ward?: string;
    q?: string;
    limit?: number;
    offset?: number;
}
export interface ParkFacilityFilters {
    bbox: string;
    category?: ParkFacilityCategory | ParkFacilityCategory[];
    conditionGrade?: ConditionGrade | ConditionGrade[];
    greenSpaceRef?: string;
    ward?: string;
    q?: string;
    limit?: number;
    offset?: number;
}
export interface PavementSectionFilters {
    bbox: string;
    pavementType?: PavementType | PavementType[];
    priorityRank?: number;
    roadRef?: string;
    ward?: string;
    q?: string;
    limit?: number;
    offset?: number;
}
export interface PumpStationFilters {
    bbox: string;
    category?: PumpStationCategory | PumpStationCategory[];
    equipmentStatus?: PumpEquipmentStatus | PumpEquipmentStatus[];
    conditionGrade?: ConditionGrade | ConditionGrade[];
    ward?: string;
    q?: string;
    limit?: number;
    offset?: number;
}
export interface InspectionRecordFilters {
    bbox?: string;
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
export interface ApiResponse<T> {
    data: T;
    meta?: {
        total?: number | null;
        limit?: number;
        offset?: number;
    };
}
export interface ApiError {
    error: string;
    message: string;
    statusCode: number;
}
export type SearchResultType = 'place' | 'coordinate' | 'event' | 'greenspace' | 'streetlight' | 'river' | 'street-tree' | 'park-facility' | 'pavement-section' | 'pump-station';
export interface SearchResult {
    id: string;
    type: SearchResultType;
    name: string;
    subtitle?: string;
    coordinates?: [number, number];
    geometry?: SupportedGeometry;
    sourceId?: string;
    metadata?: Record<string, unknown>;
}
export interface SearchResponse {
    data: {
        results: SearchResult[];
        searchCenter?: [number, number];
        isCoordinateSearch: boolean;
    };
    meta: {
        query: string;
        processingTime: number;
        error?: string;
        errorMessage?: string;
    };
}
