/**
 * 12 MongoDB benchmark queries — equivalent to poc/benchmark/queries.ts.
 *
 * Each query returns { docs: Document[], count: number } to allow the runner
 * to produce TimingSample objects compatible with the shared reporter.
 */

import type { Db, Document } from 'mongodb';

export interface MongoQueryResult {
  docs: Document[];
  count: number;
}

// ---------------------------------------------------------------------------
// Q1: Single asset PK lookup + geometry
// ---------------------------------------------------------------------------
export async function q1_assetLookup(db: Db, assetId: string): Promise<MongoQueryResult> {
  const doc = await db.collection('road_assets').findOne(
    { id: assetId },
    { projection: { id: 1, display_name: 1, road_type: 1, status: 1, condition: 1, risk_level: 1, ward: 1, geometry: 1 } },
  );
  return { docs: doc ? [doc] : [], count: doc ? 1 : 0 };
}

// ---------------------------------------------------------------------------
// Q2: Event list with status filter + priority sort
// ---------------------------------------------------------------------------
export async function q2_eventList(db: Db): Promise<MongoQueryResult> {
  const docs = await db.collection('construction_events')
    .find(
      { status: { $in: ['active', 'pending_review'] }, archived_at: null },
      { projection: { id: 1, name: 1, status: 1, start_date: 1, end_date: 1, restriction_type: 1, department: 1, ward: 1, geometry: 1 } },
    )
    .sort({ status: 1, start_date: 1 })
    .limit(50)
    .toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q3: Event detail + road assets (2 $lookup joins)
// ---------------------------------------------------------------------------
export async function q3_eventDetail(db: Db, eventId: string): Promise<MongoQueryResult> {
  const docs = await db.collection('construction_events').aggregate([
    { $match: { id: eventId } },
    { $lookup: {
      from: 'event_road_assets',
      localField: 'id',
      foreignField: 'event_id',
      as: 'era',
    }},
    { $unwind: { path: '$era', preserveNullAndEmptyArrays: true } },
    { $lookup: {
      from: 'road_assets',
      localField: 'era.road_asset_id',
      foreignField: 'id',
      as: 'ra',
    }},
    { $unwind: { path: '$ra', preserveNullAndEmptyArrays: true } },
    { $project: {
      id: 1, name: 1, status: 1, department: 1, geometry: 1,
      assetId: '$ra.id',
      assetName: '$ra.display_name',
      roadType: '$ra.road_type',
      assetGeometry: '$ra.geometry',
    }},
  ]).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q4: Event + work orders + evidence count (3-table join + GROUP BY)
// ---------------------------------------------------------------------------
export async function q4_eventWorkOrderEvidence(db: Db, eventId: string): Promise<MongoQueryResult> {
  const docs = await db.collection('construction_events').aggregate([
    { $match: { id: eventId } },
    { $lookup: {
      from: 'work_orders',
      localField: 'id',
      foreignField: 'event_id',
      as: 'wo',
    }},
    { $unwind: '$wo' },
    { $lookup: {
      from: 'evidence',
      localField: 'wo.id',
      foreignField: 'work_order_id',
      as: 'ev',
    }},
    { $project: {
      id: 1, name: 1, status: 1,
      workOrderId: '$wo.id',
      title: '$wo.title',
      woStatus: '$wo.status',
      woType: '$wo.type',
      evidenceCount: { $size: '$ev' },
      pendingCount: {
        $size: {
          $filter: {
            input: '$ev',
            as: 'e',
            cond: { $eq: ['$$e.review_status', 'pending'] },
          },
        },
      },
    }},
  ]).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q5: Full chain: Event → WO → Evidence → Decision (4-table join)
// ---------------------------------------------------------------------------
export async function q5_fullChain(db: Db, eventId: string): Promise<MongoQueryResult> {
  const docs = await db.collection('construction_events').aggregate([
    { $match: { id: eventId } },
    { $lookup: {
      from: 'work_orders',
      localField: 'id',
      foreignField: 'event_id',
      as: 'wo',
    }},
    { $unwind: '$wo' },
    { $lookup: {
      from: 'evidence',
      localField: 'wo.id',
      foreignField: 'work_order_id',
      as: 'ev',
    }},
    { $unwind: '$ev' },
    { $lookup: {
      from: 'decisions',
      let: { evId: '$ev.id' },
      pipeline: [
        { $match: {
          $expr: {
            $and: [
              { $eq: ['$entity_type', 'evidence'] },
              { $eq: ['$entity_id', '$$evId'] },
            ],
          },
        }},
      ],
      as: 'd',
    }},
    { $unwind: { path: '$d', preserveNullAndEmptyArrays: true } },
    { $project: {
      eventId: '$id',
      eventName: '$name',
      workOrderId: '$wo.id',
      woTitle: '$wo.title',
      evidenceId: '$ev.id',
      fileName: '$ev.file_name',
      reviewStatus: '$ev.review_status',
      decisionId: '$d.id',
      outcome: '$d.outcome',
      decidedBy: '$d.decided_by',
      decidedAt: '$d.decided_at',
    }},
    { $sort: { 'ev.submitted_at': -1 } },
  ]).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q6: Spatial query — assets near event geometry
// Equivalent to PostGIS ST_DWithin(geometry, event.geometry, 0.01)
// 0.01 degrees ≈ ~1.1 km, use $geoWithin with $center
// ---------------------------------------------------------------------------
export async function q6_spatialNear(db: Db, eventId: string): Promise<MongoQueryResult> {
  // First get event geometry center
  const event = await db.collection('construction_events').findOne(
    { id: eventId },
    { projection: { geometry: 1 } },
  );

  if (!event?.geometry) {
    return { docs: [], count: 0 };
  }

  // Extract center point from geometry
  let centerLng: number, centerLat: number;
  if (event.geometry.type === 'Point') {
    [centerLng, centerLat] = event.geometry.coordinates;
  } else if (event.geometry.type === 'LineString') {
    // Use midpoint
    const coords = event.geometry.coordinates;
    const mid = Math.floor(coords.length / 2);
    [centerLng, centerLat] = coords[mid];
  } else {
    // Polygon — use first coordinate
    [centerLng, centerLat] = event.geometry.coordinates[0][0];
  }

  // $geoWithin with $centerSphere: radius in radians (0.01 deg ≈ 0.000174 rad)
  const radiusRadians = 0.01 / 57.2958; // degrees to radians

  const docs = await db.collection('road_assets')
    .find({
      status: 'active',
      geometry: {
        $geoWithin: {
          $centerSphere: [[centerLng, centerLat], radiusRadians],
        },
      },
    })
    .limit(500)
    .toArray();

  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q7: Inspection + decision history (polymorphic FK)
// ---------------------------------------------------------------------------
export async function q7_inspectionDecision(db: Db, assetType: string, assetId: string): Promise<MongoQueryResult> {
  const docs = await db.collection('inspection_records').aggregate([
    { $match: { asset_type: assetType, asset_id: assetId } },
    { $lookup: {
      from: 'decisions',
      let: { irId: '$id' },
      pipeline: [
        { $match: {
          $expr: {
            $and: [
              { $eq: ['$entity_type', 'inspection'] },
              { $eq: ['$entity_id', '$$irId'] },
            ],
          },
        }},
      ],
      as: 'd',
    }},
    { $unwind: { path: '$d', preserveNullAndEmptyArrays: true } },
    { $project: {
      id: 1,
      assetType: '$asset_type',
      assetId: '$asset_id',
      inspectionType: '$inspection_type',
      result: 1,
      conditionGrade: '$condition_grade',
      decisionId: '$d.id',
      outcome: '$d.outcome',
      rationale: '$d.rationale',
    }},
    { $sort: { inspection_date: -1 } },
  ]).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q8: Audit trail for entity (JSONB snapshots)
// ---------------------------------------------------------------------------
export async function q8_auditTrail(db: Db, entityType: string, entityId: string): Promise<MongoQueryResult> {
  const docs = await db.collection('audit_logs').aggregate([
    { $match: { entity_type: entityType, entity_id: entityId } },
    { $lookup: {
      from: 'decisions',
      localField: 'decision_id',
      foreignField: 'id',
      as: 'd',
    }},
    { $unwind: { path: '$d', preserveNullAndEmptyArrays: true } },
    { $project: {
      id: 1,
      action: 1,
      description: 1,
      beforeSnapshot: '$before_snapshot',
      afterSnapshot: '$after_snapshot',
      changedFields: '$changed_fields',
      actor: 1,
      actorRole: '$actor_role',
      createdAt: '$created_at',
      decisionType: '$d.decision_type',
      outcome: '$d.outcome',
    }},
    { $sort: { created_at: -1 } },
    { $limit: 50 },
  ]).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q9: Dashboard aggregate — events by status + counts
// ---------------------------------------------------------------------------
export async function q9_dashboardAggregate(db: Db): Promise<MongoQueryResult> {
  const docs = await db.collection('construction_events').aggregate([
    { $match: { archived_at: null } },
    { $lookup: {
      from: 'work_orders',
      localField: 'id',
      foreignField: 'event_id',
      as: 'wos',
    }},
    { $lookup: {
      from: 'decisions',
      let: { eventId: '$id' },
      pipeline: [
        { $match: {
          $expr: {
            $and: [
              { $eq: ['$entity_type', 'event'] },
              { $eq: ['$entity_id', '$$eventId'] },
            ],
          },
        }},
      ],
      as: 'decs',
    }},
    // Unwind work orders to look up evidence
    { $unwind: { path: '$wos', preserveNullAndEmptyArrays: true } },
    { $lookup: {
      from: 'evidence',
      localField: 'wos.id',
      foreignField: 'work_order_id',
      as: 'evs',
    }},
    // Group back by event to collect unique IDs
    { $group: {
      _id: '$id',
      status: { $first: '$status' },
      woIds: { $addToSet: '$wos.id' },
      evIds: { $push: '$evs.id' },
      decIds: { $first: '$decs.id' },
    }},
    // Group by status for dashboard counts
    { $group: {
      _id: '$status',
      eventCount: { $sum: 1 },
      workOrderCount: { $sum: { $size: { $ifNull: ['$woIds', []] } } },
      evidenceCount: { $sum: { $size: { $reduce: { input: { $ifNull: ['$evIds', []] }, initialValue: [], in: { $concatArrays: ['$$value', '$$this'] } } } } },
      decisionCount: { $sum: { $size: { $ifNull: ['$decIds', []] } } },
    }},
    { $project: {
      _id: 0,
      status: '$_id',
      eventCount: 1,
      workOrderCount: 1,
      evidenceCount: 1,
      decisionCount: 1,
    }},
  ]).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q10: Partner-filtered work order view
// ---------------------------------------------------------------------------
export async function q10_partnerWorkOrders(db: Db, partnerId: string): Promise<MongoQueryResult> {
  const docs = await db.collection('work_order_partners').aggregate([
    { $match: { partner_id: partnerId } },
    { $lookup: {
      from: 'work_orders',
      localField: 'work_order_id',
      foreignField: 'id',
      as: 'wo',
    }},
    { $unwind: '$wo' },
    { $lookup: {
      from: 'construction_events',
      localField: 'wo.event_id',
      foreignField: 'id',
      as: 'event',
    }},
    { $unwind: '$event' },
    { $lookup: {
      from: 'evidence',
      localField: 'wo.id',
      foreignField: 'work_order_id',
      as: 'ev',
    }},
    { $project: {
      id: '$wo.id',
      title: '$wo.title',
      status: '$wo.status',
      type: '$wo.type',
      dueDate: '$wo.due_date',
      eventId: '$event.id',
      eventName: '$event.name',
      evidenceCount: { $size: '$ev' },
    }},
    { $sort: { dueDate: 1 } },
  ]).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q11: Audit activity report (time range + GROUP BY)
// ---------------------------------------------------------------------------
export async function q11_auditReport(db: Db, from: string, to: string): Promise<MongoQueryResult> {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const docs = await db.collection('audit_logs').aggregate([
    { $match: { created_at: { $gte: fromDate, $lt: toDate } } },
    { $group: {
      _id: {
        day: { $dateTrunc: { date: '$created_at', unit: 'day' } },
        entityType: '$entity_type',
        action: '$action',
      },
      count: { $sum: 1 },
      uniqueActors: { $addToSet: '$actor' },
    }},
    { $project: {
      _id: 0,
      day: '$_id.day',
      entityType: '$_id.entityType',
      action: '$_id.action',
      count: 1,
      uniqueActors: { $size: '$uniqueActors' },
    }},
    { $sort: { day: -1, count: -1 } },
  ]).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Q12: Multi-asset spatial bbox (equivalent to UNION ALL × 3 GIST scans)
// ---------------------------------------------------------------------------
export async function q12_spatialBbox(
  db: Db,
  minLng: number, minLat: number, maxLng: number, maxLat: number,
): Promise<MongoQueryResult> {
  const bbox = {
    type: 'Polygon' as const,
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat],
    ]],
  };

  const geoFilter = {
    status: 'active',
    geometry: { $geoWithin: { $geometry: bbox } },
  };

  const projection = { id: 1, display_name: 1, status: 1, geometry: 1 };

  // Run 3 queries in parallel (equivalent to UNION ALL)
  const [roads, greenspaces, trees] = await Promise.all([
    db.collection('road_assets').find(geoFilter, { projection }).toArray(),
    db.collection('greenspace_assets').find(geoFilter, { projection }).toArray(),
    db.collection('street_tree_assets').find(geoFilter, { projection }).toArray(),
  ]);

  // Tag each with assetType (like the PG UNION ALL does)
  const docs = [
    ...roads.map(d => ({ ...d, assetType: 'road' })),
    ...greenspaces.map(d => ({ ...d, assetType: 'greenspace' })),
    ...trees.map(d => ({ ...d, assetType: 'street_tree' })),
  ];

  return { docs, count: docs.length };
}
