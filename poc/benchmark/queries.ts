/**
 * 12 benchmark queries for the same-DB multi-table PoC.
 *
 * Each query function takes a pg.PoolClient and optional parameters,
 * returning the query result.
 */

import type pg from 'pg';

// ---------------------------------------------------------------------------
// Q1: Single asset PK lookup + geometry
// ---------------------------------------------------------------------------
export async function q1_assetLookup(client: pg.PoolClient, assetId: string) {
  return client.query(`
    SELECT id, display_name as "displayName", road_type as "roadType",
           status, condition, risk_level as "riskLevel", ward,
           ST_AsGeoJSON(geometry)::json as geometry
    FROM road_assets
    WHERE id = $1
  `, [assetId]);
}

// ---------------------------------------------------------------------------
// Q2: Event list with status filter + priority sort
// ---------------------------------------------------------------------------
export async function q2_eventList(client: pg.PoolClient) {
  return client.query(`
    SELECT id, name, status, start_date as "startDate", end_date as "endDate",
           restriction_type as "restrictionType", department, ward,
           ST_AsGeoJSON(geometry)::json as geometry
    FROM construction_events
    WHERE status IN ('active', 'pending_review')
      AND archived_at IS NULL
    ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'pending_review' THEN 2 END,
             start_date ASC
    LIMIT 50
  `);
}

// ---------------------------------------------------------------------------
// Q3: Event detail + road assets (2-table join)
// ---------------------------------------------------------------------------
export async function q3_eventDetail(client: pg.PoolClient, eventId: string) {
  return client.query(`
    SELECT e.id, e.name, e.status, e.department,
           ST_AsGeoJSON(e.geometry)::json as geometry,
           ra.id as "assetId", ra.display_name as "assetName",
           ra.road_type as "roadType",
           ST_AsGeoJSON(ra.geometry)::json as "assetGeometry"
    FROM construction_events e
    LEFT JOIN event_road_assets era ON era.event_id = e.id
    LEFT JOIN road_assets ra ON ra.id = era.road_asset_id
    WHERE e.id = $1
  `, [eventId]);
}

// ---------------------------------------------------------------------------
// Q4: Event + work orders + evidence count (3-table join + GROUP BY)
// ---------------------------------------------------------------------------
export async function q4_eventWorkOrderEvidence(client: pg.PoolClient, eventId: string) {
  return client.query(`
    SELECT e.id, e.name, e.status,
           wo.id as "workOrderId", wo.title, wo.status as "woStatus", wo.type as "woType",
           COUNT(ev.id)::int as "evidenceCount",
           COUNT(ev.id) FILTER (WHERE ev.review_status = 'pending')::int as "pendingCount"
    FROM construction_events e
    JOIN work_orders wo ON wo.event_id = e.id
    LEFT JOIN evidence ev ON ev.work_order_id = wo.id
    WHERE e.id = $1
    GROUP BY e.id, e.name, e.status, wo.id, wo.title, wo.status, wo.type
  `, [eventId]);
}

// ---------------------------------------------------------------------------
// Q5: Full chain: Event → WO → Evidence → Decision (4-table join)
// ---------------------------------------------------------------------------
export async function q5_fullChain(client: pg.PoolClient, eventId: string) {
  return client.query(`
    SELECT e.id as "eventId", e.name as "eventName",
           wo.id as "workOrderId", wo.title as "woTitle",
           ev.id as "evidenceId", ev.file_name as "fileName", ev.review_status as "reviewStatus",
           d.id as "decisionId", d.outcome, d.decided_by as "decidedBy", d.decided_at as "decidedAt"
    FROM construction_events e
    JOIN work_orders wo ON wo.event_id = e.id
    JOIN evidence ev ON ev.work_order_id = wo.id
    LEFT JOIN decisions d ON d.entity_type = 'evidence' AND d.entity_id = ev.id
    WHERE e.id = $1
    ORDER BY ev.submitted_at DESC
  `, [eventId]);
}

// ---------------------------------------------------------------------------
// Q6: Spatial query — assets within event geometry (ST_Intersects)
// ---------------------------------------------------------------------------
export async function q6_spatialIntersect(client: pg.PoolClient, eventId: string) {
  return client.query(`
    SELECT ra.id, ra.display_name as "displayName", ra.road_type as "roadType",
           ST_AsGeoJSON(ra.geometry)::json as geometry
    FROM road_assets ra
    WHERE ra.status = 'active'
      AND ST_DWithin(
        ra.geometry,
        (SELECT geometry FROM construction_events WHERE id = $1),
        0.01
      )
    LIMIT 500
  `, [eventId]);
}

// ---------------------------------------------------------------------------
// Q7: Inspection + decision history (polymorphic FK)
// ---------------------------------------------------------------------------
export async function q7_inspectionDecision(client: pg.PoolClient, assetType: string, assetId: string) {
  return client.query(`
    SELECT ir.id, ir.asset_type as "assetType", ir.asset_id as "assetId",
           ir.inspection_type as "inspectionType", ir.result, ir.condition_grade as "conditionGrade",
           d.id as "decisionId", d.outcome, d.rationale
    FROM inspection_records ir
    LEFT JOIN decisions d ON d.entity_type = 'inspection' AND d.entity_id = ir.id
    WHERE ir.asset_type = $1 AND ir.asset_id = $2
    ORDER BY ir.inspection_date DESC
  `, [assetType, assetId]);
}

// ---------------------------------------------------------------------------
// Q8: Audit trail for entity (JSONB snapshots)
// ---------------------------------------------------------------------------
export async function q8_auditTrail(client: pg.PoolClient, entityType: string, entityId: string) {
  return client.query(`
    SELECT al.id, al.action, al.description,
           al.before_snapshot as "beforeSnapshot",
           al.after_snapshot as "afterSnapshot",
           al.changed_fields as "changedFields",
           al.actor, al.actor_role as "actorRole",
           al.created_at as "createdAt",
           d.decision_type as "decisionType", d.outcome
    FROM audit_logs al
    LEFT JOIN decisions d ON d.id = al.decision_id
    WHERE al.entity_type = $1 AND al.entity_id = $2
    ORDER BY al.created_at DESC
    LIMIT 50
  `, [entityType, entityId]);
}

// ---------------------------------------------------------------------------
// Q9: Dashboard aggregate — events by status + counts
// ---------------------------------------------------------------------------
export async function q9_dashboardAggregate(client: pg.PoolClient) {
  return client.query(`
    SELECT e.status,
           COUNT(DISTINCT e.id)::int as "eventCount",
           COUNT(DISTINCT wo.id)::int as "workOrderCount",
           COUNT(DISTINCT ev.id)::int as "evidenceCount",
           COUNT(DISTINCT d.id)::int as "decisionCount"
    FROM construction_events e
    LEFT JOIN work_orders wo ON wo.event_id = e.id
    LEFT JOIN evidence ev ON ev.work_order_id = wo.id
    LEFT JOIN decisions d ON d.entity_type = 'event' AND d.entity_id = e.id
    WHERE e.archived_at IS NULL
    GROUP BY e.status
  `);
}

// ---------------------------------------------------------------------------
// Q10: Partner-filtered work order view
// ---------------------------------------------------------------------------
export async function q10_partnerWorkOrders(client: pg.PoolClient, partnerId: string) {
  return client.query(`
    SELECT wo.id, wo.title, wo.status, wo.type, wo.due_date as "dueDate",
           e.id as "eventId", e.name as "eventName",
           COUNT(ev.id)::int as "evidenceCount"
    FROM work_orders wo
    JOIN work_order_partners wop ON wop.work_order_id = wo.id
    JOIN construction_events e ON e.id = wo.event_id
    LEFT JOIN evidence ev ON ev.work_order_id = wo.id
    WHERE wop.partner_id = $1
    GROUP BY wo.id, wo.title, wo.status, wo.type, wo.due_date, e.id, e.name
    ORDER BY wo.due_date ASC NULLS LAST
  `, [partnerId]);
}

// ---------------------------------------------------------------------------
// Q11: Audit activity report (time range + GROUP BY)
// ---------------------------------------------------------------------------
export async function q11_auditReport(client: pg.PoolClient, from: string, to: string) {
  return client.query(`
    SELECT DATE_TRUNC('day', al.created_at) as "day",
           al.entity_type as "entityType",
           al.action,
           COUNT(*)::int as "count",
           COUNT(DISTINCT al.actor)::int as "uniqueActors"
    FROM audit_logs al
    WHERE al.created_at >= $1::timestamptz AND al.created_at < $2::timestamptz
    GROUP BY 1, 2, 3
    ORDER BY 1 DESC, 4 DESC
  `, [from, to]);
}

// ---------------------------------------------------------------------------
// Q12: Multi-asset spatial bbox (UNION ALL × 3 GIST scans)
// ---------------------------------------------------------------------------
export async function q12_spatialBbox(
  client: pg.PoolClient,
  minLng: number, minLat: number, maxLng: number, maxLat: number,
) {
  return client.query(`
    SELECT 'road' as "assetType", id, display_name as name, status,
           ST_AsGeoJSON(geometry)::json as geometry
    FROM road_assets
    WHERE ST_Intersects(geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      AND status = 'active'
    UNION ALL
    SELECT 'greenspace', id, display_name, status,
           ST_AsGeoJSON(geometry)::json as geometry
    FROM greenspace_assets
    WHERE ST_Intersects(geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      AND status = 'active'
    UNION ALL
    SELECT 'street_tree', id, display_name, status,
           ST_AsGeoJSON(geometry)::json as geometry
    FROM street_tree_assets
    WHERE ST_Intersects(geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      AND status = 'active'
  `, [minLng, minLat, maxLng, maxLat]);
}

// ---------------------------------------------------------------------------
// Query metadata (for runner)
// ---------------------------------------------------------------------------
export const QUERY_METADATA = [
  { name: 'Q1', label: 'Asset PK lookup + geometry', fn: 'q1_assetLookup' },
  { name: 'Q2', label: 'Event list + status filter + sort', fn: 'q2_eventList' },
  { name: 'Q3', label: 'Event detail + road assets (2 joins)', fn: 'q3_eventDetail' },
  { name: 'Q4', label: 'Event + WO + evidence count (3 joins)', fn: 'q4_eventWorkOrderEvidence' },
  { name: 'Q5', label: 'Full chain Event→WO→Evidence→Decision (4 joins)', fn: 'q5_fullChain' },
  { name: 'Q6', label: 'Spatial ST_DWithin (GIST)', fn: 'q6_spatialIntersect' },
  { name: 'Q7', label: 'Inspection + decision (polymorphic)', fn: 'q7_inspectionDecision' },
  { name: 'Q8', label: 'Audit trail + JSONB snapshots', fn: 'q8_auditTrail' },
  { name: 'Q9', label: 'Dashboard aggregate (3 LEFT JOINs + GROUP BY)', fn: 'q9_dashboardAggregate' },
  { name: 'Q10', label: 'Partner-filtered WO view', fn: 'q10_partnerWorkOrders' },
  { name: 'Q11', label: 'Audit activity report (time range)', fn: 'q11_auditReport' },
  { name: 'Q12', label: 'Multi-asset spatial bbox (3 UNION ALL)', fn: 'q12_spatialBbox' },
] as const;
