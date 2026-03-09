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
import type { Property, Relationship, GeoProperty, DateTime, URI, CivicOperation, WorkOrder as NgsiWorkOrder, Road, GreenSpace, Streetlight, WaterBody, Evidence as NgsiEvidence, StreetTree, ParkFacility, PavementSection, PumpStation, InspectionRecord as NgsiInspectionRecord, LifecyclePlan as NgsiLifecyclePlan } from '../types/ngsi-ld';
import type { ConstructionEvent, WorkOrder, RoadAsset, GreenSpaceAsset, StreetLightAsset, RiverAsset, Evidence, StreetTreeAsset, ParkFacilityAsset, PavementSectionAsset, PumpStationAsset, InspectionRecord, LifecyclePlan } from '../types/index';
import type { Geometry } from 'geojson';
declare function prop<T>(value: T | undefined | null): Property<T> | undefined;
declare function propRequired<T>(value: T): Property<T>;
declare function rel(targetId: URI | URI[] | undefined | null): Relationship | undefined;
declare function geo<G extends Geometry>(geometry: G | undefined | null): GeoProperty<G> | undefined;
declare function geoRequired<G extends Geometry>(geometry: G): GeoProperty<G>;
declare function ts(value: string | Date | undefined | null): DateTime | undefined;
/** Extract the plain value from a NGSI-LD Property */
declare function val<T>(p: Property<T> | undefined): T | undefined;
/** Extract the object URI from a NGSI-LD Relationship */
declare function relTarget(r: Relationship | undefined): string | undefined;
/** Extract the geometry from a NGSI-LD GeoProperty */
declare function geoVal<G extends Geometry>(g: GeoProperty<G> | undefined): G | undefined;
/** Strip the URN prefix to get the local ID */
declare function localId(urn: URI): string;
export declare function toNgsiLdCivicOperation(event: ConstructionEvent): CivicOperation;
export declare function fromNgsiLdCivicOperation(entity: CivicOperation): Partial<ConstructionEvent>;
export declare function toNgsiLdWorkOrder(wo: WorkOrder): NgsiWorkOrder;
export declare function fromNgsiLdWorkOrder(entity: NgsiWorkOrder): Partial<WorkOrder>;
export declare function toNgsiLdRoad(road: RoadAsset): Road;
export declare function fromNgsiLdRoad(entity: Road): Partial<RoadAsset>;
export declare function toNgsiLdGreenSpace(gs: GreenSpaceAsset): GreenSpace;
export declare function toNgsiLdStreetlight(sl: StreetLightAsset): Streetlight;
export declare function toNgsiLdWaterBody(river: RiverAsset): WaterBody;
export declare function toNgsiLdEvidence(ev: Evidence): NgsiEvidence;
export declare function toNgsiLdStreetTree(tree: StreetTreeAsset): StreetTree;
export declare function toNgsiLdParkFacility(facility: ParkFacilityAsset): ParkFacility;
export declare function toNgsiLdPavementSection(section: PavementSectionAsset): PavementSection;
export declare function toNgsiLdPumpStation(station: PumpStationAsset): PumpStation;
export declare function toNgsiLdInspectionRecord(record: InspectionRecord): NgsiInspectionRecord;
export declare function toNgsiLdLifecyclePlan(plan: LifecyclePlan): NgsiLifecyclePlan;
export { prop, propRequired, rel, geo, geoRequired, val, relTarget, geoVal, localId, ts, };
