/**
 * Converters: PostGIS (internal) ↔ NGSI-LD (external) entity representations
 *
 * These functions translate between the Drizzle/PostGIS row format used internally
 * and the NGSI-LD normalized format used for external APIs, context brokers (Orion-LD),
 * and cross-system data exchange.
 *
 * Direction:
 *   toNgsiLd*()  — DB row → NGSI-LD entity  (for publishing)
 *   fromNgsiLd*() — NGSI-LD entity → DB row  (for ingesting)
 */

import type {
  Property,
  Relationship,
  GeoProperty,
  DateTime,
  URI,
  CivicOperation,
  WorkOrder as NgsiWorkOrder,
  WorkLocation,
  Road,
  GreenSpace,
  Streetlight,
  WaterBody,
  Evidence as NgsiEvidence,
  StreetTree,
  ParkFacility,
  PavementSection,
  PumpStation,
  InspectionRecord as NgsiInspectionRecord,
  LifecyclePlan as NgsiLifecyclePlan,
} from '../types/ngsi-ld';
import {
  DEFAULT_CONTEXT,
  entityId,
  CivicOperationStatus,
  WorkOrderResolutionStatus,
} from '../types/ngsi-ld';
import type {
  ConstructionEvent,
  WorkOrder,
  WorkOrderLocation,
  RoadAsset,
  GreenSpaceAsset,
  StreetLightAsset,
  RiverAsset,
  Evidence,
  StreetTreeAsset,
  ParkFacilityAsset,
  PavementSectionAsset,
  PumpStationAsset,
  InspectionRecord,
  LifecyclePlan,
} from '../types/index';
import type { Geometry, Point } from 'geojson';

// ============================================================
// Helper builders
// ============================================================

function prop<T>(value: T | undefined | null): Property<T> | undefined {
  if (value === undefined || value === null) return undefined;
  return { type: 'Property', value };
}

function propRequired<T>(value: T): Property<T> {
  return { type: 'Property', value };
}

function rel(targetId: URI | URI[] | undefined | null): Relationship | undefined {
  if (!targetId) return undefined;
  return { type: 'Relationship', object: targetId };
}

function geo<G extends Geometry>(geometry: G | undefined | null): GeoProperty<G> | undefined {
  if (!geometry) return undefined;
  return { type: 'GeoProperty', value: geometry };
}

function geoRequired<G extends Geometry>(geometry: G): GeoProperty<G> {
  return { type: 'GeoProperty', value: geometry };
}

function ts(value: string | Date | undefined | null): DateTime | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

/** Extract the plain value from a NGSI-LD Property */
function val<T>(p: Property<T> | undefined): T | undefined {
  return p?.value;
}

/** Extract the object URI from a NGSI-LD Relationship */
function relTarget(r: Relationship | undefined): string | undefined {
  if (!r) return undefined;
  return Array.isArray(r.object) ? r.object[0] : r.object;
}

/** Extract the geometry from a NGSI-LD GeoProperty */
function geoVal<G extends Geometry>(g: GeoProperty<G> | undefined): G | undefined {
  return g?.value;
}

/** Strip the URN prefix to get the local ID */
function localId(urn: URI): string {
  const idx = urn.lastIndexOf(':');
  return idx >= 0 ? urn.slice(idx + 1) : urn;
}

// ============================================================
// Status mapping between internal ↔ NGSI-LD
// ============================================================

const eventStatusToNgsi: Record<string, string> = {
  planned: CivicOperationStatus.Planned,
  active: CivicOperationStatus.Ongoing,
  pending_review: CivicOperationStatus.PendingReview,
  closed: CivicOperationStatus.Finished,
  archived: CivicOperationStatus.Archived,
  cancelled: CivicOperationStatus.Cancelled,
};

const eventStatusFromNgsi: Record<string, string> = {
  [CivicOperationStatus.Planned]: 'planned',
  [CivicOperationStatus.Scheduled]: 'planned',
  [CivicOperationStatus.Ongoing]: 'active',
  [CivicOperationStatus.PendingReview]: 'pending_review',
  [CivicOperationStatus.Finished]: 'closed',
  [CivicOperationStatus.Archived]: 'archived',
  [CivicOperationStatus.Cancelled]: 'cancelled',
};

const woStatusToNgsi: Record<string, string> = {
  draft: WorkOrderResolutionStatus.Open,
  assigned: WorkOrderResolutionStatus.Assigned,
  in_progress: WorkOrderResolutionStatus.InProgress,
  completed: WorkOrderResolutionStatus.Closed,
  cancelled: WorkOrderResolutionStatus.Cancelled,
};

const woStatusFromNgsi: Record<string, string> = {
  [WorkOrderResolutionStatus.Open]: 'draft',
  [WorkOrderResolutionStatus.Assigned]: 'assigned',
  [WorkOrderResolutionStatus.InProgress]: 'in_progress',
  [WorkOrderResolutionStatus.Closed]: 'completed',
  [WorkOrderResolutionStatus.Cancelled]: 'cancelled',
};

const restrictionToNgsi: Record<string, string> = {
  full: 'fullClosure',
  partial: 'partialClosure',
  workzone: 'workZone',
};

const restrictionFromNgsi: Record<string, string> = {
  fullClosure: 'full',
  partialClosure: 'partial',
  workZone: 'workzone',
};

const lampTypeToNgsi: Record<string, string> = {
  led: 'LED',
  sodium: 'HPS',
  mercury: 'mercuryVapor',
  fluorescent: 'fluorescent',
  halogen: 'halogen',
};

const lampTypeFromNgsi: Record<string, string> = {
  LED: 'led',
  LPS: 'sodium',
  HPS: 'sodium',
  mercuryVapor: 'mercury',
  fluorescent: 'fluorescent',
  halogen: 'halogen',
};

const lampStatusToNgsi: Record<string, string> = {
  operational: 'ok',
  maintenance: 'underMaintenance',
  damaged: 'damaged',
  replaced: 'replaced',
};

const lampStatusFromNgsi: Record<string, string> = {
  ok: 'operational',
  defective: 'maintenance',
  underMaintenance: 'maintenance',
  damaged: 'damaged',
  replaced: 'replaced',
};

// ============================================================
// §1  CivicOperation ↔ ConstructionEvent
// ============================================================

// Asset type to NGSI-LD entity type mapping for refAsset relationship
const assetTypeToNgsiEntityType: Record<string, string> = {
  road: 'Road',
  river: 'WaterBody',
  streetlight: 'Streetlight',
  greenspace: 'GreenSpace',
  street_tree: 'StreetTree',
  park_facility: 'ParkFacility',
  pavement_section: 'PavementSection',
  pump_station: 'PumpStation',
};

export function toNgsiLdCivicOperation(event: ConstructionEvent): CivicOperation {
  const entity: CivicOperation = {
    id: entityId('CivicOperation', event.id),
    type: 'CivicOperation',
    '@context': DEFAULT_CONTEXT,

    name: propRequired(event.name),
    status: propRequired(eventStatusToNgsi[event.status] ?? event.status) as Property<any>,
    startDate: propRequired(event.startDate),
    endDate: propRequired(event.endDate),
    restrictionCategory: propRequired(
      restrictionToNgsi[event.restrictionType] ?? event.restrictionType
    ) as Property<any>,
    location: geoRequired(event.geometry as any),
    postEndDecision: propRequired(event.postEndDecision) as Property<any>,
    department: propRequired(event.department),

    modifiedAt: event.updatedAt,
  };

  // Optional properties — only include if present
  if (event.geometrySource) entity.geometrySource = prop(event.geometrySource) as any;
  if (event.ward) entity.ward = prop(event.ward);
  if (event.createdBy) entity.createdBy = prop(event.createdBy);
  if (event.closedBy) entity.closedBy = prop(event.closedBy);
  if (event.closedAt) entity.closedAt = prop(event.closedAt);
  if (event.closeNotes) entity.closeNotes = prop(event.closeNotes);
  if (event.archivedAt) entity.archivedAt = prop(event.archivedAt);

  // Relationships
  if (event.roadAssets?.length) {
    entity.refAffectedAsset = {
      type: 'Relationship',
      object: event.roadAssets.map(r => entityId('Road', r.id)),
    };
  }
  if (event.workOrders?.length) {
    entity.refWorkOrder = {
      type: 'Relationship',
      object: event.workOrders.map(w => entityId('WorkOrder', w.id)),
    };
  }
  // Singular asset reference (only if both fields are present)
  if (event.refAssetId && event.refAssetType) {
    const ngsiType = assetTypeToNgsiEntityType[event.refAssetType];
    if (ngsiType) {
      entity.refAsset = {
        type: 'Relationship',
        object: entityId(ngsiType as any, event.refAssetId),
      };
    }
  }

  return entity;
}

export function fromNgsiLdCivicOperation(entity: CivicOperation): Partial<ConstructionEvent> {
  return {
    id: localId(entity.id),
    name: val(entity.name) ?? '',
    status: (eventStatusFromNgsi[val(entity.status) ?? ''] ?? 'planned') as any,
    startDate: val(entity.startDate) ?? '',
    endDate: val(entity.endDate) ?? '',
    restrictionType: (restrictionFromNgsi[val(entity.restrictionCategory) ?? ''] ?? 'workzone') as any,
    geometry: entity.location?.value as any,
    geometrySource: val(entity.geometrySource) as any,
    postEndDecision: val(entity.postEndDecision) as any ?? 'pending',
    department: val(entity.department) ?? '',
    ward: val(entity.ward),
    createdBy: val(entity.createdBy),
    closedBy: val(entity.closedBy),
    closedAt: val(entity.closedAt),
    closeNotes: val(entity.closeNotes),
    archivedAt: val(entity.archivedAt),
    updatedAt: entity.modifiedAt ?? new Date().toISOString(),
  };
}

// ============================================================
// §2  NgsiWorkOrder ↔ WorkOrder
// ============================================================

export function toNgsiLdWorkOrder(wo: WorkOrder): NgsiWorkOrder {
  const entity: NgsiWorkOrder = {
    id: entityId('WorkOrder', wo.id),
    type: 'WorkOrder',
    '@context': DEFAULT_CONTEXT,

    title: propRequired(wo.title),
    category: propRequired(wo.type) as Property<any>,
    resolutionStatus: propRequired(
      woStatusToNgsi[wo.status] ?? wo.status
    ) as Property<any>,
    refCivicOperation: { type: 'Relationship', object: entityId('CivicOperation', wo.eventId) },

    createdAt: wo.createdAt,
    modifiedAt: wo.updatedAt,
  };

  if (wo.description) entity.description = prop(wo.description);
  if (wo.assignedDept) entity.assignedDepartment = prop(wo.assignedDept);
  if (wo.assignedBy) entity.assignedBy = prop(wo.assignedBy);
  if (wo.assignedAt) entity.assignedAt = prop(wo.assignedAt);
  if (wo.dueDate) entity.dueDate = prop(wo.dueDate);
  if (wo.startedAt) entity.dateStarted = prop(wo.startedAt);
  if (wo.completedAt) entity.dateFinished = prop(wo.completedAt);
  if (wo.reviewedBy) entity.reviewedBy = prop(wo.reviewedBy);
  if (wo.reviewedAt) entity.reviewedAt = prop(wo.reviewedAt);
  if (wo.reviewNotes) entity.reviewNotes = prop(wo.reviewNotes);
  if (wo.createdBy) entity.createdBy = prop(wo.createdBy);

  if (wo.locations?.length) {
    entity.refWorkLocation = {
      type: 'Relationship',
      object: wo.locations.map(l => entityId('WorkOrder', `${wo.id}:loc:${l.id}`)),
    };
  }
  if (wo.evidence?.length) {
    entity.refEvidence = {
      type: 'Relationship',
      object: wo.evidence.map(e => entityId('Evidence', e.id)),
    };
  }

  return entity;
}

export function fromNgsiLdWorkOrder(entity: NgsiWorkOrder): Partial<WorkOrder> {
  return {
    id: localId(entity.id),
    title: val(entity.title) ?? '',
    type: val(entity.category) as any ?? 'inspection',
    status: (woStatusFromNgsi[val(entity.resolutionStatus) ?? ''] ?? 'draft') as any,
    eventId: localId(relTarget(entity.refCivicOperation) ?? ''),
    description: val(entity.description),
    assignedDept: val(entity.assignedDepartment),
    assignedBy: val(entity.assignedBy),
    assignedAt: val(entity.assignedAt),
    dueDate: val(entity.dueDate),
    startedAt: val(entity.dateStarted),
    completedAt: val(entity.dateFinished),
    reviewedBy: val(entity.reviewedBy),
    reviewedAt: val(entity.reviewedAt),
    reviewNotes: val(entity.reviewNotes),
    createdBy: val(entity.createdBy),
    createdAt: entity.createdAt ?? new Date().toISOString(),
    updatedAt: entity.modifiedAt ?? new Date().toISOString(),
  };
}

// ============================================================
// §3  Road ↔ RoadAsset
// ============================================================

export function toNgsiLdRoad(road: RoadAsset): Road {
  const entity: Road = {
    id: entityId('Road', road.id),
    type: 'Road',
    '@context': DEFAULT_CONTEXT,

    roadClass: propRequired(road.roadType) as Property<any>,
    location: geoRequired(road.geometry as any),
    status: propRequired(road.status) as Property<any>,
    validFrom: propRequired(road.validFrom),

    modifiedAt: road.updatedAt,
  };

  if (road.name) entity.name = prop(road.name);
  if (road.nameJa) entity.alternateName = prop(road.nameJa);
  if (road.ref) entity.refCode = prop(road.ref);
  if (road.localRef) entity.localRef = prop(road.localRef);
  if (road.displayName) entity.displayName = prop(road.displayName);
  if (road.lanes) entity.totalLaneNumber = prop(road.lanes);
  if (road.direction) entity.direction = prop(road.direction);
  if (road.validTo) entity.validTo = prop(road.validTo);
  if (road.ownerDepartment) entity.responsible = prop(road.ownerDepartment);
  if (road.ward) entity.ward = prop(road.ward);
  if (road.landmark) entity.landmark = prop(road.landmark);
  if (road.sublocality) entity.sublocality = prop(road.sublocality);
  if (road.crossSection) entity.crossSection = prop(road.crossSection);
  if (road.managingDept) entity.managingDept = prop(road.managingDept);
  if (road.intersection) entity.intersection = prop(road.intersection);
  if (road.pavementState) entity.pavementState = prop(road.pavementState);
  if (road.nameSource) entity.nameSource = prop(road.nameSource);
  if (road.nameConfidence) entity.nameConfidence = prop(road.nameConfidence);
  if (road.dataSource) entity.dataProvider = prop(road.dataSource) as any;
  if (road.sourceVersion) entity.sourceVersion = prop(road.sourceVersion);
  if (road.sourceDate) entity.sourceDate = prop(road.sourceDate);
  if (road.lastVerifiedAt) entity.lastVerifiedAt = prop(road.lastVerifiedAt);
  if (road.osmType) entity.osmType = prop(road.osmType);
  if (road.osmId) entity.osmId = prop(Number(road.osmId));
  if (road.osmTimestamp) entity.osmTimestamp = prop(road.osmTimestamp);
  if (road.lastSyncedAt) entity.lastSyncedAt = prop(road.lastSyncedAt);
  if (road.isManuallyEdited != null) entity.isManuallyEdited = prop(road.isManuallyEdited);
  if (road.replacedBy) entity.refReplacedBy = rel(entityId('Road', road.replacedBy));
  if (road.condition) entity.condition = prop(road.condition);
  if (road.riskLevel) entity.riskLevel = prop(road.riskLevel);

  return entity;
}

export function fromNgsiLdRoad(entity: Road): Partial<RoadAsset> {
  return {
    id: localId(entity.id),
    name: val(entity.name),
    nameJa: val(entity.alternateName),
    ref: val(entity.refCode),
    localRef: val(entity.localRef),
    displayName: val(entity.displayName),
    geometry: geoVal(entity.location) as any,
    roadType: val(entity.roadClass) as any ?? 'local',
    lanes: val(entity.totalLaneNumber) ?? 2,
    direction: val(entity.direction) ?? 'both',
    status: val(entity.status) as any ?? 'active',
    validFrom: val(entity.validFrom) ?? new Date().toISOString(),
    validTo: val(entity.validTo),
    ownerDepartment: val(entity.responsible),
    ward: val(entity.ward),
    landmark: val(entity.landmark),
    sublocality: val(entity.sublocality),
    crossSection: val(entity.crossSection),
    managingDept: val(entity.managingDept),
    intersection: val(entity.intersection),
    pavementState: val(entity.pavementState),
    nameSource: val(entity.nameSource) as any,
    nameConfidence: val(entity.nameConfidence) as any,
    dataSource: val(entity.dataProvider) as any,
    sourceVersion: val(entity.sourceVersion),
    sourceDate: val(entity.sourceDate),
    lastVerifiedAt: val(entity.lastVerifiedAt),
    osmType: val(entity.osmType) as any,
    osmId: val(entity.osmId) != null ? String(val(entity.osmId)) : undefined,
    osmTimestamp: val(entity.osmTimestamp),
    lastSyncedAt: val(entity.lastSyncedAt),
    isManuallyEdited: val(entity.isManuallyEdited),
    replacedBy: entity.refReplacedBy ? localId(relTarget(entity.refReplacedBy) ?? '') : undefined,
    updatedAt: entity.modifiedAt ?? new Date().toISOString(),
  };
}

// ============================================================
// §4  GreenSpace ↔ GreenSpaceAsset
// ============================================================

export function toNgsiLdGreenSpace(gs: GreenSpaceAsset): GreenSpace {
  const entity: GreenSpace = {
    id: entityId('GreenSpace', gs.id),
    type: 'GreenSpace',
    '@context': DEFAULT_CONTEXT,

    category: propRequired(gs.greenSpaceType) as Property<any>,
    location: geoRequired(gs.geometry),
    status: propRequired(gs.status) as Property<any>,

    modifiedAt: gs.updatedAt,
  };

  if (gs.name) entity.name = prop(gs.name);
  if (gs.nameJa) entity.alternateName = prop(gs.nameJa);
  if (gs.displayName) entity.displayName = prop(gs.displayName);
  if (gs.areaM2) entity.areaServed = prop(gs.areaM2);
  if (gs.operator) entity.operator = prop(gs.operator);
  if (gs.leisureType) entity.leisureType = prop(gs.leisureType);
  if (gs.landuseType) entity.landuseType = prop(gs.landuseType);
  if (gs.naturalType) entity.naturalType = prop(gs.naturalType);
  if (gs.vegetationType) entity.vegetationType = prop(gs.vegetationType);
  if (gs.ward) entity.ward = prop(gs.ward);
  if (gs.dataSource) entity.dataProvider = prop(gs.dataSource) as any;
  if (gs.sourceVersion) entity.sourceVersion = prop(gs.sourceVersion);
  if (gs.sourceDate) entity.sourceDate = prop(gs.sourceDate);
  if (gs.lastVerifiedAt) entity.lastVerifiedAt = prop(gs.lastVerifiedAt);
  if (gs.osmType) entity.osmType = prop(gs.osmType);
  if (gs.osmId) entity.osmId = prop(Number(gs.osmId));
  if (gs.osmTimestamp) entity.osmTimestamp = prop(gs.osmTimestamp);
  if (gs.lastSyncedAt) entity.lastSyncedAt = prop(gs.lastSyncedAt);
  if (gs.isManuallyEdited != null) entity.isManuallyEdited = prop(gs.isManuallyEdited);
  if (gs.condition) entity.condition = prop(gs.condition);
  if (gs.riskLevel) entity.riskLevel = prop(gs.riskLevel);

  return entity;
}

// ============================================================
// §5  Streetlight ↔ StreetLightAsset
// ============================================================

export function toNgsiLdStreetlight(sl: StreetLightAsset): Streetlight {
  const entity: Streetlight = {
    id: entityId('Streetlight', sl.id),
    type: 'Streetlight',
    '@context': DEFAULT_CONTEXT,

    lampTechnology: propRequired(
      lampTypeToNgsi[sl.lampType] ?? sl.lampType
    ) as Property<any>,
    operatingStatus: propRequired(
      lampStatusToNgsi[sl.lampStatus] ?? sl.lampStatus
    ) as Property<any>,
    location: geoRequired(sl.geometry),
    status: propRequired(sl.status) as Property<any>,

    modifiedAt: sl.updatedAt,
  };

  if (sl.lampId) entity.lampId = prop(sl.lampId);
  if (sl.displayName) entity.displayName = prop(sl.displayName);
  if (sl.wattage) entity.powerConsumption = prop(sl.wattage);
  if (sl.installDate) entity.dateInstalled = prop(sl.installDate);
  if (sl.ward) entity.ward = prop(sl.ward);
  if (sl.roadRef) entity.refRoad = rel(entityId('Road', sl.roadRef));
  if (sl.dataSource) entity.dataProvider = prop(sl.dataSource) as any;
  if (sl.osmType) entity.osmType = prop(sl.osmType);
  if (sl.osmId) entity.osmId = prop(Number(sl.osmId));
  if (sl.condition) entity.condition = prop(sl.condition);
  if (sl.riskLevel) entity.riskLevel = prop(sl.riskLevel);

  return entity;
}

// ============================================================
// §6  WaterBody ↔ RiverAsset
// ============================================================

export function toNgsiLdWaterBody(river: RiverAsset): WaterBody {
  const entity: WaterBody = {
    id: entityId('WaterBody', river.id),
    type: 'WaterBody',
    '@context': DEFAULT_CONTEXT,

    category: propRequired(river.waterwayType ?? 'river') as Property<any>,
    location: geoRequired(river.geometry as any),
    geometryRepresentation: propRequired(river.geometryType) as Property<any>,
    status: propRequired(river.status) as Property<any>,

    modifiedAt: river.updatedAt,
  };

  if (river.name) entity.name = prop(river.name);
  if (river.nameJa) entity.alternateName = prop(river.nameJa);
  if (river.displayName) entity.displayName = prop(river.displayName);
  if (river.width) entity.width = prop(river.width);
  if (river.managementLevel) entity.managementLevel = prop(river.managementLevel) as any;
  if (river.maintainer) entity.maintainer = prop(river.maintainer);
  if (river.ward) entity.ward = prop(river.ward);
  if (river.dataSource) entity.dataProvider = prop(river.dataSource) as any;
  if (river.osmType) entity.osmType = prop(river.osmType);
  if (river.osmId) entity.osmId = prop(Number(river.osmId));
  if (river.condition) entity.condition = prop(river.condition);
  if (river.riskLevel) entity.riskLevel = prop(river.riskLevel);

  return entity;
}

// ============================================================
// §7  Evidence ↔ Evidence
// ============================================================

export function toNgsiLdEvidence(ev: Evidence): NgsiEvidence {
  const entity: NgsiEvidence = {
    id: entityId('Evidence', ev.id),
    type: 'Evidence',
    '@context': DEFAULT_CONTEXT,

    mediaType: propRequired(ev.type) as Property<any>,
    fileName: propRequired(ev.fileName),
    filePath: propRequired(ev.filePath),
    submittedBy: propRequired(ev.submittedBy),
    submittedAt: propRequired(ev.submittedAt),
    reviewStatus: propRequired(ev.reviewStatus) as Property<any>,
    refWorkOrder: { type: 'Relationship', object: entityId('WorkOrder', ev.workOrderId) },
  };

  if (ev.title) entity.title = prop(ev.title);
  if (ev.description) entity.description = prop(ev.description);
  if (ev.fileSizeBytes) entity.fileSizeBytes = prop(ev.fileSizeBytes);
  if (ev.mimeType) entity.mimeType = prop(ev.mimeType);
  if (ev.captureDate) entity.captureDate = prop(ev.captureDate);
  if (ev.geometry) entity.location = geo(ev.geometry);
  if (ev.reviewedBy) entity.reviewedBy = prop(ev.reviewedBy);
  if (ev.reviewedAt) entity.reviewedAt = prop(ev.reviewedAt);
  if (ev.reviewNotes) entity.reviewNotes = prop(ev.reviewNotes);

  return entity;
}

// ============================================================
// §8  StreetTree ↔ StreetTreeAsset
// ============================================================

export function toNgsiLdStreetTree(tree: StreetTreeAsset): StreetTree {
  const entity: StreetTree = {
    id: entityId('StreetTree', tree.id),
    type: 'StreetTree',
    '@context': DEFAULT_CONTEXT,

    category: propRequired(tree.category) as Property<any>,
    healthStatus: propRequired(tree.healthStatus) as Property<any>,
    location: geoRequired(tree.geometry),
    status: propRequired(tree.status) as Property<any>,

    modifiedAt: tree.updatedAt,
    createdAt: tree.createdAt,
  };

  if (tree.ledgerId) entity.ledgerId = prop(tree.ledgerId);
  if (tree.displayName) entity.displayName = prop(tree.displayName);
  if (tree.speciesName) entity.speciesName = prop(tree.speciesName);
  if (tree.scientificName) entity.scientificName = prop(tree.scientificName);
  if (tree.trunkDiameter != null) entity.trunkDiameter = prop(tree.trunkDiameter);
  if (tree.height != null) entity.height = prop(tree.height);
  if (tree.crownSpread != null) entity.crownSpread = prop(tree.crownSpread);
  if (tree.datePlanted) entity.datePlanted = prop(tree.datePlanted);
  if (tree.estimatedAge != null) entity.estimatedAge = prop(tree.estimatedAge);
  if (tree.conditionGrade) entity.conditionGrade = prop(tree.conditionGrade) as any;
  if (tree.lastDiagnosticDate) entity.lastDiagnosticDate = prop(tree.lastDiagnosticDate);
  if (tree.diagnosticNotes) entity.diagnosticNotes = prop(tree.diagnosticNotes);
  if (tree.ward) entity.ward = prop(tree.ward);
  if (tree.managingDept) entity.managingDept = prop(tree.managingDept);
  if (tree.roadRef) entity.refRoad = rel(entityId('Road', tree.roadRef));
  if (tree.greenSpaceRef) entity.refGreenSpace = rel(entityId('GreenSpace', tree.greenSpaceRef));
  if (tree.dataSource) entity.dataProvider = prop(tree.dataSource) as any;
  if (tree.sourceVersion) entity.sourceVersion = prop(tree.sourceVersion);
  if (tree.sourceDate) entity.sourceDate = prop(tree.sourceDate);
  if (tree.lastVerifiedAt) entity.lastVerifiedAt = prop(tree.lastVerifiedAt);
  if (tree.condition) entity.condition = prop(tree.condition);
  if (tree.riskLevel) entity.riskLevel = prop(tree.riskLevel);

  return entity;
}

// ============================================================
// §9  ParkFacility ↔ ParkFacilityAsset
// ============================================================

export function toNgsiLdParkFacility(facility: ParkFacilityAsset): ParkFacility {
  const entity: ParkFacility = {
    id: entityId('ParkFacility', facility.id),
    type: 'ParkFacility',
    '@context': DEFAULT_CONTEXT,

    name: propRequired(facility.name),
    category: propRequired(facility.category) as Property<any>,
    location: geoRequired(facility.geometry as any),
    status: propRequired(facility.status) as Property<any>,
    refGreenSpace: { type: 'Relationship', object: entityId('GreenSpace', facility.greenSpaceRef) },

    modifiedAt: facility.updatedAt,
    createdAt: facility.createdAt,
  };

  if (facility.facilityId) entity.facilityId = prop(facility.facilityId);
  if (facility.description) entity.description = prop(facility.description);
  if (facility.subCategory) entity.subCategory = prop(facility.subCategory);
  if (facility.dateInstalled) entity.dateInstalled = prop(facility.dateInstalled);
  if (facility.manufacturer) entity.manufacturer = prop(facility.manufacturer);
  if (facility.material) entity.material = prop(facility.material);
  if (facility.quantity != null) entity.quantity = prop(facility.quantity);
  if (facility.designLife != null) entity.designLife = prop(facility.designLife);
  if (facility.conditionGrade) entity.conditionGrade = prop(facility.conditionGrade) as any;
  if (facility.lastInspectionDate) entity.lastInspectionDate = prop(facility.lastInspectionDate);
  if (facility.nextInspectionDate) entity.nextInspectionDate = prop(facility.nextInspectionDate);
  if (facility.safetyConcern != null) entity.safetyConcern = prop(facility.safetyConcern);
  if (facility.ward) entity.ward = prop(facility.ward);
  if (facility.managingDept) entity.managingDept = prop(facility.managingDept);
  if (facility.dataSource) entity.dataProvider = prop(facility.dataSource) as any;
  if (facility.sourceVersion) entity.sourceVersion = prop(facility.sourceVersion);
  if (facility.lastVerifiedAt) entity.lastVerifiedAt = prop(facility.lastVerifiedAt);
  if (facility.condition) entity.condition = prop(facility.condition);
  if (facility.riskLevel) entity.riskLevel = prop(facility.riskLevel);

  return entity;
}

// ============================================================
// §10  PavementSection ↔ PavementSectionAsset
// ============================================================

export function toNgsiLdPavementSection(section: PavementSectionAsset): PavementSection {
  const entity: PavementSection = {
    id: entityId('PavementSection', section.id),
    type: 'PavementSection',
    '@context': DEFAULT_CONTEXT,

    pavementType: propRequired(section.pavementType) as Property<any>,
    location: geoRequired(section.geometry as any),
    status: propRequired(section.status) as Property<any>,
    refRoad: { type: 'Relationship', object: entityId('Road', section.roadRef) },

    modifiedAt: section.updatedAt,
    createdAt: section.createdAt,
  };

  if (section.sectionId) entity.sectionId = prop(section.sectionId);
  if (section.name) entity.name = prop(section.name);
  if (section.routeNumber) entity.routeNumber = prop(section.routeNumber);
  if (section.length != null) entity.length = prop(section.length);
  if (section.width != null) entity.width = prop(section.width);
  if (section.thickness != null) entity.thickness = prop(section.thickness);
  if (section.lastResurfacingDate) entity.lastResurfacingDate = prop(section.lastResurfacingDate);
  if (section.mci != null) entity.mci = prop(section.mci);
  if (section.crackRate != null) entity.crackRate = prop(section.crackRate);
  if (section.rutDepth != null) entity.rutDepth = prop(section.rutDepth);
  if (section.iri != null) entity.iri = prop(section.iri);
  if (section.lastMeasurementDate) entity.lastMeasurementDate = prop(section.lastMeasurementDate);
  if (section.plannedInterventionYear != null) entity.plannedInterventionYear = prop(section.plannedInterventionYear);
  if (section.estimatedCost != null) entity.estimatedCost = prop(section.estimatedCost);
  if (section.priorityRank != null) entity.priorityRank = prop(section.priorityRank);
  if (section.ward) entity.ward = prop(section.ward);
  if (section.managingDept) entity.managingDept = prop(section.managingDept);
  if (section.dataSource) entity.dataProvider = prop(section.dataSource) as any;
  if (section.sourceVersion) entity.sourceVersion = prop(section.sourceVersion);
  if (section.lastVerifiedAt) entity.lastVerifiedAt = prop(section.lastVerifiedAt);
  if (section.condition) entity.condition = prop(section.condition);
  if (section.riskLevel) entity.riskLevel = prop(section.riskLevel);

  return entity;
}

// ============================================================
// §11  PumpStation ↔ PumpStationAsset
// ============================================================

export function toNgsiLdPumpStation(station: PumpStationAsset): PumpStation {
  const entity: PumpStation = {
    id: entityId('PumpStation', station.id),
    type: 'PumpStation',
    '@context': DEFAULT_CONTEXT,

    name: propRequired(station.name),
    category: propRequired(station.category) as Property<any>,
    equipmentStatus: propRequired(station.equipmentStatus) as Property<any>,
    location: geoRequired(station.geometry as any),
    status: propRequired(station.status) as Property<any>,

    modifiedAt: station.updatedAt,
    createdAt: station.createdAt,
  };

  if (station.stationId) entity.stationId = prop(station.stationId);
  if (station.description) entity.description = prop(station.description);
  if (station.dateCommissioned) entity.dateCommissioned = prop(station.dateCommissioned);
  if (station.designCapacity != null) entity.designCapacity = prop(station.designCapacity);
  if (station.pumpCount != null) entity.pumpCount = prop(station.pumpCount);
  if (station.totalPower != null) entity.totalPower = prop(station.totalPower);
  if (station.drainageArea != null) entity.drainageArea = prop(station.drainageArea);
  if (station.conditionGrade) entity.conditionGrade = prop(station.conditionGrade) as any;
  if (station.lastMaintenanceDate) entity.lastMaintenanceDate = prop(station.lastMaintenanceDate);
  if (station.nextMaintenanceDate) entity.nextMaintenanceDate = prop(station.nextMaintenanceDate);
  if (station.ward) entity.ward = prop(station.ward);
  if (station.managingDept) entity.managingDept = prop(station.managingDept);
  if (station.managingOffice) entity.managingOffice = prop(station.managingOffice);
  if (station.riverRef) entity.refWaterBody = rel(entityId('WaterBody', station.riverRef));
  if (station.dataSource) entity.dataProvider = prop(station.dataSource) as any;
  if (station.sourceVersion) entity.sourceVersion = prop(station.sourceVersion);
  if (station.lastVerifiedAt) entity.lastVerifiedAt = prop(station.lastVerifiedAt);
  if (station.condition) entity.condition = prop(station.condition);
  if (station.riskLevel) entity.riskLevel = prop(station.riskLevel);

  return entity;
}

// ============================================================
// §12  InspectionRecord ↔ InspectionRecord (expanded)
// ============================================================

/** Map assetType to NGSI-LD entity type for relationship */
const assetTypeToEntityType: Record<string, string> = {
  road: 'Road',
  'street-tree': 'StreetTree',
  'park-facility': 'ParkFacility',
  'pavement-section': 'PavementSection',
  'pump-station': 'PumpStation',
};

export function toNgsiLdInspectionRecord(record: InspectionRecord): NgsiInspectionRecord {
  // Normalize assetType/assetId from legacy roadAssetId
  const assetType = record.assetType ?? (record.roadAssetId ? 'road' : undefined);
  const assetId = record.assetId ?? record.roadAssetId ?? undefined;

  const entity: NgsiInspectionRecord = {
    id: entityId('InspectionRecord', record.id),
    type: 'InspectionRecord',
    '@context': DEFAULT_CONTEXT,

    inspectionType: propRequired(record.inspectionType ?? 'routine') as Property<any>,
    inspectionDate: propRequired(record.inspectionDate),
    result: propRequired(record.result) as Property<any>,
    refInspectedAsset: assetType && assetId
      ? { type: 'Relationship', object: entityId((assetTypeToEntityType[assetType] ?? 'Road') as any, assetId) }
      : { type: 'Relationship', object: '' },

    createdAt: record.createdAt,
    modifiedAt: record.updatedAt,
  };

  if (record.conditionGrade) entity.conditionGrade = prop(record.conditionGrade) as any;
  if (record.findings) entity.findings = prop(record.findings);
  if (record.inspector) entity.inspector = prop(record.inspector);
  if (record.inspectorOrganization) entity.inspectorOrganization = prop(record.inspectorOrganization);
  if (record.measurements) entity.measurements = prop(record.measurements);
  if (record.mediaUrls?.length) entity.mediaUrls = prop(record.mediaUrls);
  if (record.geometry) entity.location = geo(record.geometry);
  if (record.notes) entity.findings = prop(record.notes);  // Map legacy notes to findings

  // Event relationship
  if (record.eventId) {
    entity.refCivicOperation = rel(entityId('CivicOperation', record.eventId));
  }
  // WorkOrder relationship
  if (record.refWorkOrderId) {
    entity.refWorkOrder = rel(entityId('WorkOrder', record.refWorkOrderId));
  }

  return entity;
}

// ============================================================
// §13  LifecyclePlan ↔ LifecyclePlan
// ============================================================

export function toNgsiLdLifecyclePlan(plan: LifecyclePlan): NgsiLifecyclePlan {
  const entity: NgsiLifecyclePlan = {
    id: entityId('LifecyclePlan', plan.id),
    type: 'LifecyclePlan',
    '@context': DEFAULT_CONTEXT,

    title: propRequired(plan.title),
    planStartYear: propRequired(plan.planStartYear),
    planEndYear: propRequired(plan.planEndYear),
    assetType: propRequired(plan.assetType),
    refAsset: plan.assetRef
      ? { type: 'Relationship', object: entityId((assetTypeToEntityType[plan.assetType] ?? plan.assetType) as any, plan.assetRef) }
      : { type: 'Relationship', object: '' },

    createdAt: plan.createdAt,
    modifiedAt: plan.updatedAt,
  };

  if (plan.version) entity.version = prop(plan.version);
  if (plan.planStatus) entity.planStatus = prop(plan.planStatus) as any;
  if (plan.baselineCondition) entity.baselineCondition = prop(plan.baselineCondition) as any;
  if (plan.designLife != null) entity.designLife = prop(plan.designLife);
  if (plan.remainingLife != null) entity.remainingLife = prop(plan.remainingLife);
  if (plan.interventions?.length) entity.interventions = prop(plan.interventions) as any;
  if (plan.totalLifecycleCostJpy != null) entity.totalLifecycleCostJpy = prop(plan.totalLifecycleCostJpy);
  if (plan.annualAverageCostJpy != null) entity.annualAverageCostJpy = prop(plan.annualAverageCostJpy);
  if (plan.managingDept) entity.managingDept = prop(plan.managingDept);
  if (plan.createdBy) entity.createdBy = prop(plan.createdBy);
  if (plan.approvedAt) entity.approvedAt = prop(plan.approvedAt);

  return entity;
}

// ============================================================
// Exports
// ============================================================

export {
  prop,
  propRequired,
  rel,
  geo,
  geoRequired,
  val,
  relTarget,
  geoVal,
  localId,
  ts,
};
