/**
 * Seed script for RFI entities with realistic Nagoya coordinates.
 *
 * Entities:
 * - Street Trees (街路樹) — along real Nagoya streets
 * - Park Facilities (公園施設) — at real park locations
 * - Pavement Sections (道路舗装) — on real road segments
 * - Pump Stations (ポンプ施設) — near real rivers/waterways
 * - Lifecycle Plans (長寿命化計画)
 * - Inspection Records (点検記録)
 *
 * Run: npx tsx src/db/seed-rfi.ts
 *
 * Prerequisites: Existing greenspace_assets, road_assets, and river_assets records.
 */

import { db } from './index.js';
import { sql } from 'drizzle-orm';
import { toGeomSql } from './geometry.js';

// ---------------------------------------------------------------------------
// Geometry helpers — absolute coordinates
// ---------------------------------------------------------------------------
function point(lng: number, lat: number): { type: 'Point'; coordinates: [number, number] } {
  return { type: 'Point', coordinates: [lng, lat] };
}

function lineString(coords: [number, number][]): { type: 'LineString'; coordinates: [number, number][] } {
  return { type: 'LineString', coordinates: coords };
}

// ---------------------------------------------------------------------------
// Prerequisites — look up existing base assets for FK references
// ---------------------------------------------------------------------------
async function findPrerequisites() {
  const gsResult = await db.execute<{ id: string; lng: number; lat: number }>(sql`
    SELECT id,
      ST_X(ST_Centroid(geometry::geometry)) as lng,
      ST_Y(ST_Centroid(geometry::geometry)) as lat
    FROM greenspace_assets
    WHERE status = 'active'
    ORDER BY id
    LIMIT 50
  `);

  const roadResult = await db.execute<{ id: string; lng: number; lat: number }>(sql`
    SELECT id,
      ST_X(ST_Centroid(geometry::geometry)) as lng,
      ST_Y(ST_Centroid(geometry::geometry)) as lat
    FROM road_assets
    WHERE status = 'active'
    ORDER BY id
    LIMIT 50
  `);

  const riverResult = await db.execute<{ id: string; lng: number; lat: number }>(sql`
    SELECT id,
      ST_X(ST_Centroid(geometry::geometry)) as lng,
      ST_Y(ST_Centroid(geometry::geometry)) as lat
    FROM river_assets
    WHERE status = 'active'
    ORDER BY id
    LIMIT 20
  `);

  return {
    greenSpaces: gsResult.rows,
    roads: roadResult.rows,
    rivers: riverResult.rows,
  };
}

// Find the closest reference asset to a given coordinate
function findClosest<T extends { lng: number; lat: number; id: string }>(
  assets: T[],
  lng: number,
  lat: number,
): T | undefined {
  if (assets.length === 0) return undefined;
  let best = assets[0];
  let bestDist = Infinity;
  for (const a of assets) {
    const d = (a.lng - lng) ** 2 + (a.lat - lat) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------
async function seedRfi() {
  console.log('[seed-rfi] Starting RFI demo seed (real Nagoya coordinates)...');

  const { greenSpaces, roads, rivers } = await findPrerequisites();

  if (greenSpaces.length === 0) {
    console.error('[seed-rfi] No greenspace_assets found. Please import greenspaces first.');
    process.exit(1);
  }
  if (roads.length === 0) {
    console.error('[seed-rfi] No road_assets found. Please import roads first.');
    process.exit(1);
  }
  if (rivers.length === 0) {
    console.warn('[seed-rfi] No river_assets found. Pump stations seeded without riverRef.');
  }

  console.log(`[seed-rfi] Found ${greenSpaces.length} greenspaces, ${roads.length} roads, ${rivers.length} rivers`);

  // Clear existing RFI data (order matters for references)
  console.log('[seed-rfi] Clearing existing RFI data...');
  await db.execute(sql`DELETE FROM lifecycle_plans`);
  await db.execute(sql`DELETE FROM inspection_records WHERE asset_type IS NOT NULL AND asset_type != 'road'`);
  await db.execute(sql`DELETE FROM park_facilities`);
  await db.execute(sql`DELETE FROM street_tree_assets`);
  await db.execute(sql`DELETE FROM pavement_sections`);
  await db.execute(sql`DELETE FROM pump_stations`);

  // =======================================================================
  // 1. STREET TREES (街路樹) — 20 trees along real Nagoya streets
  // =======================================================================
  console.log('[seed-rfi] Seeding street trees...');

  const treeData = [
    // 久屋大通 (Hisaya-odori) — 有名なイチョウ並木
    { id: 'ST-001', name: 'イチョウ',   sci: 'Ginkgo biloba',         cat: 'deciduous', health: 'healthy',   grade: 'A', h: 15, d: 45, lng: 136.9085, lat: 35.1720, ward: '中区',   street: '久屋大通',   cond: 'good',      risk: 'low' },
    { id: 'ST-002', name: 'イチョウ',   sci: 'Ginkgo biloba',         cat: 'deciduous', health: 'healthy',   grade: 'A', h: 14, d: 42, lng: 136.9085, lat: 35.1735, ward: '中区',   street: '久屋大通',   cond: 'good',      risk: 'low' },
    { id: 'ST-003', name: 'イチョウ',   sci: 'Ginkgo biloba',         cat: 'deciduous', health: 'declining', grade: 'C', h: 12, d: 50, lng: 136.9085, lat: 35.1750, ward: '中区',   street: '久屋大通',   cond: 'attention', risk: 'medium' },
    { id: 'ST-004', name: 'ケヤキ',     sci: 'Zelkova serrata',       cat: 'deciduous', health: 'healthy',   grade: 'B', h: 18, d: 55, lng: 136.9085, lat: 35.1765, ward: '中区',   street: '久屋大通',   cond: 'good',      risk: 'low' },

    // 桜通 (Sakura-dori) — サクラ並木
    { id: 'ST-005', name: 'サクラ',     sci: 'Cerasus × yedoensis',   cat: 'deciduous', health: 'healthy',   grade: 'A', h: 8,  d: 25, lng: 136.9000, lat: 35.1710, ward: '中区',   street: '桜通',       cond: 'good',      risk: 'low' },
    { id: 'ST-006', name: 'サクラ',     sci: 'Cerasus × yedoensis',   cat: 'deciduous', health: 'healthy',   grade: 'A', h: 9,  d: 28, lng: 136.9050, lat: 35.1710, ward: '中区',   street: '桜通',       cond: 'good',      risk: 'low' },
    { id: 'ST-007', name: 'サクラ',     sci: 'Cerasus × yedoensis',   cat: 'deciduous', health: 'hazardous', grade: 'D', h: 7,  d: 30, lng: 136.9100, lat: 35.1710, ward: '中区',   street: '桜通',       cond: 'bad',       risk: 'high' },
    { id: 'ST-008', name: 'クスノキ',   sci: 'Cinnamomum camphora',   cat: 'evergreen', health: 'healthy',   grade: 'A', h: 20, d: 70, lng: 136.9150, lat: 35.1710, ward: '中区',   street: '桜通',       cond: 'good',      risk: 'low' },

    // 若宮大通 (Wakamiya-odori)
    { id: 'ST-009', name: 'ケヤキ',     sci: 'Zelkova serrata',       cat: 'deciduous', health: 'healthy',   grade: 'B', h: 16, d: 48, lng: 136.9000, lat: 35.1635, ward: '中区',   street: '若宮大通',   cond: 'good',      risk: 'low' },
    { id: 'ST-010', name: 'クスノキ',   sci: 'Cinnamomum camphora',   cat: 'evergreen', health: 'healthy',   grade: 'A', h: 22, d: 80, lng: 136.9050, lat: 35.1635, ward: '中区',   street: '若宮大通',   cond: 'good',      risk: 'low' },
    { id: 'ST-011', name: 'ケヤキ',     sci: 'Zelkova serrata',       cat: 'deciduous', health: 'declining', grade: 'C', h: 14, d: 40, lng: 136.9100, lat: 35.1635, ward: '中区',   street: '若宮大通',   cond: 'attention', risk: 'medium' },

    // 広小路通 (Hirokoji-dori)
    { id: 'ST-012', name: 'プラタナス', sci: 'Platanus × acerifolia', cat: 'deciduous', health: 'healthy',   grade: 'B', h: 15, d: 45, lng: 136.9000, lat: 35.1680, ward: '中区',   street: '広小路通',   cond: 'good',      risk: 'low' },
    { id: 'ST-013', name: 'プラタナス', sci: 'Platanus × acerifolia', cat: 'deciduous', health: 'healthy',   grade: 'A', h: 16, d: 50, lng: 136.9060, lat: 35.1680, ward: '中区',   street: '広小路通',   cond: 'good',      risk: 'low' },

    // 鶴舞公園周辺 (around Tsuruma Park)
    { id: 'ST-014', name: 'サクラ',     sci: 'Cerasus × yedoensis',   cat: 'deciduous', health: 'healthy',   grade: 'A', h: 10, d: 32, lng: 136.9195, lat: 35.1580, ward: '昭和区', street: '鶴舞公園通', cond: 'good',      risk: 'low' },
    { id: 'ST-015', name: 'マツ',       sci: 'Pinus thunbergii',      cat: 'conifer',   health: 'healthy',   grade: 'B', h: 12, d: 35, lng: 136.9215, lat: 35.1580, ward: '昭和区', street: '鶴舞公園通', cond: 'good',      risk: 'low' },

    // 名城公園周辺 (around Meijo Park)
    { id: 'ST-016', name: 'クスノキ',   sci: 'Cinnamomum camphora',   cat: 'evergreen', health: 'healthy',   grade: 'A', h: 25, d: 90, lng: 136.9040, lat: 35.1870, ward: '北区',   street: '名城公園通', cond: 'good',      risk: 'low' },
    { id: 'ST-017', name: 'ケヤキ',     sci: 'Zelkova serrata',       cat: 'deciduous', health: 'dead',      grade: 'S', h: 20, d: 65, lng: 136.9060, lat: 35.1870, ward: '北区',   street: '名城公園通', cond: 'bad',       risk: 'high' },

    // 大津通 (Otsu-dori)
    { id: 'ST-018', name: 'ツツジ',     sci: 'Rhododendron',          cat: 'shrub',     health: 'healthy',   grade: 'A', h: 1.5, d: 5,  lng: 136.9070, lat: 35.1700, ward: '中区',  street: '大津通',     cond: 'good',      risk: 'low' },
    { id: 'ST-019', name: 'モミジ',     sci: 'Acer palmatum',         cat: 'deciduous', health: 'healthy',   grade: 'B', h: 6,   d: 15, lng: 136.9070, lat: 35.1715, ward: '中区',  street: '大津通',     cond: 'good',      risk: 'low' },
    { id: 'ST-020', name: 'ヤシ',       sci: 'Trachycarpus fortunei', cat: 'palmLike',  health: 'healthy',   grade: 'A', h: 8,   d: 20, lng: 136.9070, lat: 35.1730, ward: '中区',  street: '大津通',     cond: 'good',      risk: 'low' },
  ];

  for (let i = 0; i < treeData.length; i++) {
    const t = treeData[i];
    const geom = point(t.lng, t.lat);
    const closestRoad = findClosest(roads, t.lng, t.lat);
    await db.execute(sql`
      INSERT INTO street_tree_assets (
        id, ledger_id, display_name, species_name, scientific_name, category,
        trunk_diameter, height, crown_spread, estimated_age, health_status, condition_grade,
        condition, risk_level,
        geometry, status, ward, managing_dept, road_ref, data_source
      ) VALUES (
        ${t.id}, ${`LG-${1000 + i}`}, ${`${t.name}（${t.street}）`}, ${t.name}, ${t.sci}, ${t.cat},
        ${String(t.d)}, ${String(t.h)}, ${String(Math.round(t.d * 0.15))}, ${Math.round(t.d * 0.8)},
        ${t.health}, ${t.grade},
        ${t.cond}, ${t.risk},
        ${toGeomSql(geom)}, 'active', ${t.ward}, '緑政土木局',
        ${closestRoad?.id ?? null}, 'manual'
      ) ON CONFLICT DO NOTHING
    `);
  }
  console.log(`[seed-rfi] Inserted ${treeData.length} street trees`);

  // =======================================================================
  // 2. PARK FACILITIES (公園施設) — at real park locations
  // =======================================================================
  console.log('[seed-rfi] Seeding park facilities...');

  // Single test park: 志賀公園 — all facilities consolidated here
  const parkDefs = [
    { search: '志賀公園',     ward: '北区' },
  ];

  const parkLocations: { park: string; baseLng: number; baseLat: number; ward: string; gsId: string }[] = [];
  for (const pd of parkDefs) {
    const res = await db.execute<{ id: string; name: string; lng: number; lat: number }>(sql`
      SELECT id, name,
        ST_X(ST_Centroid(geometry::geometry)) as lng,
        ST_Y(ST_Centroid(geometry::geometry)) as lat
      FROM greenspace_assets
      WHERE name ILIKE ${pd.search + '%'}
      ORDER BY name
      LIMIT 1
    `);
    if (res.rows.length === 0) {
      console.warn(`[seed-rfi] WARNING: Greenspace not found for "${pd.search}", using fallback`);
      const fallback = findClosest(greenSpaces, 136.9085, 35.1700);
      parkLocations.push({ park: pd.search, baseLng: 136.9085, baseLat: 35.1700, ward: pd.ward, gsId: fallback!.id });
    } else {
      const r = res.rows[0];
      console.log(`[seed-rfi] Park "${pd.search}" → ${r.id} (${r.name}) at ${Number(r.lng).toFixed(4)}, ${Number(r.lat).toFixed(4)}`);
      parkLocations.push({ park: pd.search, baseLng: Number(r.lng), baseLat: Number(r.lat), ward: pd.ward, gsId: r.id });
    }
  }

  // Category description mapping for Japanese descriptions
  const catDesc: Record<string, string> = {
    toilet: 'トイレ施設', playground: '遊具施設', bench: 'ベンチ', shelter: '東屋',
    waterFountain: '飲料水設備', signBoard: '案内板', fence: 'フェンス',
    sportsFacility: '運動施設', building: '管理棟', lighting: '照明灯',
    drainage: '排水設備', gate: '門扉',
  };

  // All facilities in 志賀公園 (park: 0) — single test case
  // Spread across park in a 6x3 grid pattern (±0.0008 lng, ±0.0006 lat)
  const facilityData = [
    // Row 1 (north) — lat +0.0006
    { id: 'PF-001', name: '志賀公園 トイレ棟（北）',      cat: 'toilet',         grade: 'B', safety: false, park: 0, dLng: -0.0008, dLat:  0.0006, installed: '2010-04-01', material: 'reinforced_concrete', life: 40, cond: 'good',      risk: 'low' },
    { id: 'PF-003', name: '志賀公園 遊具広場',          cat: 'playground',     grade: 'A', safety: false, park: 0, dLng: -0.0002, dLat:  0.0006, installed: '2018-03-01', material: 'steel', life: 25,                           cond: 'good',      risk: 'low' },
    { id: 'PF-005', name: '志賀公園 東屋',             cat: 'shelter',        grade: 'B', safety: false, park: 0, dLng:  0.0004, dLat:  0.0006, installed: '2012-04-01', material: 'wood', life: 20,                            cond: 'good',      risk: 'low' },
    // Row 2 (upper-mid) — lat +0.0003
    { id: 'PF-006', name: '志賀公園 飲料水器（入口）',    cat: 'waterFountain',  grade: 'D', safety: true,  park: 0, dLng: -0.0008, dLat:  0.0003, installed: '2008-04-01', material: 'stainless_steel', life: 20,                  cond: 'bad',       risk: 'high' },
    { id: 'PF-008', name: '志賀公園 遊具（ブランコ）',    cat: 'playground',     grade: 'B', safety: false, park: 0, dLng: -0.0002, dLat:  0.0003, installed: '2016-04-01', material: 'steel', life: 25,                           cond: 'good',      risk: 'low' },
    { id: 'PF-015', name: '志賀公園 照明灯（南側）',     cat: 'lighting',       grade: 'B', safety: false, park: 0, dLng:  0.0004, dLat:  0.0003, installed: '2020-04-01', material: 'aluminum', life: 20,                        cond: 'good',      risk: 'low' },
    // Row 3 (center) — lat 0
    { id: 'PF-004', name: '志賀公園 ベンチ群（広場）',    cat: 'bench',          grade: 'B', safety: false, park: 0, dLng: -0.0008, dLat:  0.0000, installed: '2015-04-01', material: 'wood', life: 15,                            cond: 'good',      risk: 'low' },
    { id: 'PF-013', name: '志賀公園 管理棟',            cat: 'building',       grade: 'A', safety: false, park: 0, dLng: -0.0002, dLat:  0.0000, installed: '2019-04-01', material: 'reinforced_concrete', life: 50, cond: 'good',      risk: 'low' },
    { id: 'PF-011', name: '志賀公園 噴水設備',          cat: 'waterFountain',  grade: 'C', safety: false, park: 0, dLng:  0.0004, dLat:  0.0000, installed: '2010-04-01', material: 'stone', life: 30,                            cond: 'attention', risk: 'medium' },
    // Row 4 (lower-mid) — lat -0.0003
    { id: 'PF-007', name: '志賀公園 トイレ棟（東）',      cat: 'toilet',         grade: 'A', safety: false, park: 0, dLng: -0.0008, dLat: -0.0003, installed: '2020-04-01', material: 'reinforced_concrete', life: 40, cond: 'good',      risk: 'low' },
    { id: 'PF-017', name: '志賀公園 遊具（滑り台）',     cat: 'playground',     grade: 'C', safety: true,  park: 0, dLng: -0.0002, dLat: -0.0003, installed: '2008-04-01', material: 'steel', life: 25,                           cond: 'attention', risk: 'medium' },
    { id: 'PF-016', name: '志賀公園 排水設備',          cat: 'drainage',       grade: 'B', safety: false, park: 0, dLng:  0.0004, dLat: -0.0003, installed: '2012-04-01', material: 'concrete', life: 30,                         cond: 'good',      risk: 'low' },
    // Row 5 (south) — lat -0.0006
    { id: 'PF-009', name: '志賀公園 案内板（正門）',      cat: 'signBoard',      grade: 'A', safety: false, park: 0, dLng: -0.0008, dLat: -0.0006, installed: '2022-04-01', material: 'aluminum', life: 15,                        cond: 'good',      risk: 'low' },
    { id: 'PF-012', name: '志賀公園 テニスコート',       cat: 'sportsFacility', grade: 'B', safety: false, park: 0, dLng: -0.0002, dLat: -0.0006, installed: '2015-04-01', material: 'asphalt', life: 20,                         cond: 'good',      risk: 'low' },
    { id: 'PF-010', name: '志賀公園 フェンス（東側）',    cat: 'fence',          grade: 'D', safety: true,  park: 0, dLng:  0.0004, dLat: -0.0006, installed: '2000-04-01', material: 'steel', life: 20,                           cond: 'bad',       risk: 'high' },
    // Row 6 (far south) — lat -0.0009
    { id: 'PF-002', name: '志賀公園 トイレ棟（南）',      cat: 'toilet',         grade: 'C', safety: false, park: 0, dLng: -0.0006, dLat: -0.0009, installed: '2005-04-01', material: 'reinforced_concrete', life: 40, cond: 'attention', risk: 'medium' },
    { id: 'PF-014', name: '志賀公園 ベンチ（池前）',     cat: 'bench',          grade: 'A', safety: false, park: 0, dLng:  0.0000, dLat: -0.0009, installed: '2021-04-01', material: 'wood', life: 15,                            cond: 'good',      risk: 'low' },
    { id: 'PF-018', name: '志賀公園 門扉（北入口）',     cat: 'gate',           grade: 'B', safety: false, park: 0, dLng:  0.0004, dLat: -0.0007, installed: '2014-04-01', material: 'steel', life: 25,                           cond: 'good',      risk: 'low' },
  ];

  for (let i = 0; i < facilityData.length; i++) {
    const f = facilityData[i];
    const parkLoc = parkLocations[f.park];
    const geom = point(parkLoc.baseLng + f.dLng, parkLoc.baseLat + f.dLat);

    await db.execute(sql`
      INSERT INTO park_facilities (
        id, facility_id, name, description, category,
        date_installed, material, quantity, design_life,
        condition_grade, safety_concern,
        condition, risk_level,
        geometry, status, ward, managing_dept, green_space_ref, data_source
      ) VALUES (
        ${f.id}, ${`FC-${2000 + i}`}, ${f.name},
        ${`${parkLoc.park}内の${catDesc[f.cat] ?? '施設'}`}, ${f.cat},
        ${new Date(f.installed)}, ${f.material}, ${1}, ${f.life},
        ${f.grade}, ${f.safety},
        ${f.cond}, ${f.risk},
        ${toGeomSql(geom)}, 'active', ${parkLoc.ward}, '緑政土木局',
        ${parkLoc.gsId}, 'manual'
      ) ON CONFLICT DO NOTHING
    `);
  }
  console.log(`[seed-rfi] Inserted ${facilityData.length} park facilities`);

  // =======================================================================
  // 3. PAVEMENT SECTIONS (道路舗装) — on real Nagoya road segments
  // =======================================================================
  console.log('[seed-rfi] Seeding pavement sections...');

  const pavementData = [
    // 桜通 (Sakura-dori)
    { id: 'PS-001', name: '桜通 丸の内〜久屋大通',  route: '市道桜通線',     type: 'asphalt',  mci: '7.5', crack: '3.2',  rut: '5.0',  iri: '2.8', rank: 4, ward: '中区',   len: '950',  w: '18.0', cond: 'good',      risk: 'low',
      coords: [[136.8980, 35.1712], [136.9085, 35.1712]] as [number, number][] },
    { id: 'PS-002', name: '桜通 久屋大通〜東新町',  route: '市道桜通線',     type: 'asphalt',  mci: '5.8', crack: '8.5',  rut: '12.0', iri: '4.2', rank: 2, ward: '中区',   len: '780',  w: '18.0', cond: 'attention', risk: 'medium',
      coords: [[136.9085, 35.1712], [136.9170, 35.1712]] as [number, number][] },

    // 若宮大通 (Wakamiya-odori)
    { id: 'PS-003', name: '若宮大通 大須〜上前津',   route: '市道若宮大通線', type: 'asphalt',  mci: '6.2', crack: '6.8',  rut: '9.5',  iri: '3.5', rank: 3, ward: '中区',   len: '1100', w: '25.0', cond: 'attention', risk: 'medium',
      coords: [[136.8980, 35.1635], [136.9100, 35.1635]] as [number, number][] },

    // 広小路通 (Hirokoji-dori)
    { id: 'PS-004', name: '広小路通 名駅〜納屋橋',   route: '市道広小路線',   type: 'asphalt',  mci: '8.0', crack: '2.0',  rut: '3.5',  iri: '2.2', rank: 5, ward: '中村区', len: '720',  w: '20.0', cond: 'good',      risk: 'low',
      coords: [[136.8880, 35.1680], [136.8960, 35.1680]] as [number, number][] },
    { id: 'PS-005', name: '広小路通 納屋橋〜栄',     route: '市道広小路線',   type: 'asphalt',  mci: '4.2', crack: '14.5', rut: '18.0', iri: '6.1', rank: 1, ward: '中区',   len: '1150', w: '20.0', cond: 'attention', risk: 'medium',
      coords: [[136.8960, 35.1680], [136.9085, 35.1680]] as [number, number][] },

    // 鶴舞通
    { id: 'PS-006', name: '鶴舞通 鶴舞駅〜荒畑',    route: '市道鶴舞1号線', type: 'concrete', mci: '3.8', crack: '18.0', rut: '20.0', iri: '7.2', rank: 1, ward: '昭和区', len: '650',  w: '12.0', cond: 'bad',       risk: 'high',
      coords: [[136.9180, 35.1560], [136.9250, 35.1560]] as [number, number][] },

    // 名城通
    { id: 'PS-007', name: '名城通 市役所〜名城公園', route: '市道名城通線',   type: 'asphalt',  mci: '6.8', crack: '5.0',  rut: '7.5',  iri: '3.0', rank: 3, ward: '北区',   len: '670',  w: '15.0', cond: 'attention', risk: 'medium',
      coords: [[136.9047, 35.1810], [136.9047, 35.1870]] as [number, number][] },

    // 大津通 (Otsu-dori)
    { id: 'PS-008', name: '大津通 栄〜矢場町',      route: '市道大津通線',   type: 'asphalt',  mci: '7.0', crack: '4.5',  rut: '6.0',  iri: '2.5', rank: 4, ward: '中区',   len: '720',  w: '16.0', cond: 'good',      risk: 'low',
      coords: [[136.9070, 35.1700], [136.9070, 35.1635]] as [number, number][] },
  ];

  for (let i = 0; i < pavementData.length; i++) {
    const p = pavementData[i];
    const geom = lineString(p.coords);
    const midLng = (p.coords[0][0] + p.coords[p.coords.length - 1][0]) / 2;
    const midLat = (p.coords[0][1] + p.coords[p.coords.length - 1][1]) / 2;
    const closestRoad = findClosest(roads, midLng, midLat);

    await db.execute(sql`
      INSERT INTO pavement_sections (
        id, section_id, name, route_number, pavement_type,
        length, width, thickness, last_resurfacing_date,
        mci, crack_rate, rut_depth, iri, last_measurement_date,
        planned_intervention_year, estimated_cost, priority_rank,
        condition, risk_level,
        geometry, status, ward, managing_dept, road_ref, data_source
      ) VALUES (
        ${p.id}, ${`SEC-${3000 + i}`}, ${p.name}, ${p.route}, ${p.type},
        ${p.len}, ${p.w}, ${'20.0'}, ${new Date('2020-08-01')},
        ${p.mci}, ${p.crack}, ${p.rut}, ${p.iri}, ${new Date('2024-06-15')},
        ${2026 + (p.rank <= 2 ? 0 : p.rank <= 3 ? 1 : 2)},
        ${String(10000000 + (5 - p.rank) * 5000000)}, ${p.rank},
        ${p.cond}, ${p.risk},
        ${toGeomSql(geom)}, 'active', ${p.ward}, '緑政土木局',
        ${closestRoad!.id}, 'manual'
      ) ON CONFLICT DO NOTHING
    `);
  }
  console.log(`[seed-rfi] Inserted ${pavementData.length} pavement sections`);

  // =======================================================================
  // 4. PUMP STATIONS (ポンプ施設) — near real Nagoya rivers
  // =======================================================================
  console.log('[seed-rfi] Seeding pump stations...');

  const pumpData = [
    // 堀川沿い (along Horikawa, central Nagoya)
    { id: 'PUMP-001', sid: 'PS-4001', name: '納屋橋排水ポンプ場',  desc: '堀川沿いの雨水排水ポンプ場',       cat: 'stormwater', lng: 136.8960, lat: 35.1695, ward: '中区',
      cap: '15.00', pumps: 3, power: '200.00', area: '55.00', eqStatus: 'operational',      grade: 'B', commissioned: '2008-03-15', office: '中土木事務所',     cond: 'good',      risk: 'low' },
    { id: 'PUMP-002', sid: 'PS-4002', name: '松重排水ポンプ場',    desc: '堀川下流域の汚水排水ポンプ場',     cat: 'sewage',     lng: 136.8920, lat: 35.1600, ward: '中区',
      cap: '20.00', pumps: 4, power: '300.00', area: '80.00', eqStatus: 'operational',      grade: 'A', commissioned: '2015-04-01', office: '中土木事務所',     cond: 'good',      risk: 'low' },

    // 庄内川沿い (along Shonai River, north Nagoya)
    { id: 'PUMP-003', sid: 'PS-4003', name: '庄内川第一ポンプ場',  desc: '庄内川南岸の雨水・汚水兼用ポンプ場', cat: 'combined',   lng: 136.8800, lat: 35.1990, ward: '西区',
      cap: '30.00', pumps: 5, power: '500.00', area: '120.00', eqStatus: 'underMaintenance', grade: 'C', commissioned: '2000-04-01', office: '西土木事務所',   cond: 'attention', risk: 'medium' },

    // 山崎川沿い (along Yamazaki River, south-east)
    { id: 'PUMP-004', sid: 'PS-4004', name: '瑞穂排水ポンプ場',    desc: '山崎川沿いの雨水排水ポンプ場',     cat: 'stormwater', lng: 136.9350, lat: 35.1350, ward: '瑞穂区',
      cap: '10.00', pumps: 2, power: '120.00', area: '35.00', eqStatus: 'operational',      grade: 'B', commissioned: '2012-04-01', office: '瑞穂土木事務所', cond: 'good',      risk: 'low' },

    // 天白川沿い (along Tenpaku River, south)
    { id: 'PUMP-005', sid: 'PS-4005', name: '天白排水ポンプ場',    desc: '天白川流域の農業用水兼排水ポンプ場', cat: 'irrigation', lng: 136.9500, lat: 35.1000, ward: '天白区',
      cap: '8.00',  pumps: 2, power: '80.00',  area: '25.00', eqStatus: 'standby',          grade: 'D', commissioned: '1995-04-01', office: '天白土木事務所', cond: 'bad',       risk: 'high' },
  ];

  for (const p of pumpData) {
    const geom = point(p.lng, p.lat);
    const closestRiver = findClosest(rivers, p.lng, p.lat);

    await db.execute(sql`
      INSERT INTO pump_stations (
        id, station_id, name, description, category,
        date_commissioned, design_capacity, pump_count, total_power, drainage_area,
        equipment_status, condition_grade, last_maintenance_date, next_maintenance_date,
        condition, risk_level,
        geometry, status, ward, managing_dept, managing_office,
        river_ref, data_source
      ) VALUES (
        ${p.id}, ${p.sid}, ${p.name}, ${p.desc}, ${p.cat},
        ${new Date(p.commissioned)}, ${p.cap}, ${p.pumps}, ${p.power}, ${p.area},
        ${p.eqStatus}, ${p.grade}, ${new Date('2024-10-01')}, ${new Date('2025-10-01')},
        ${p.cond}, ${p.risk},
        ${toGeomSql(geom)}, 'active', ${p.ward}, '上下水道局', ${p.office},
        ${closestRiver?.id ?? null}, 'manual'
      ) ON CONFLICT DO NOTHING
    `);
  }
  console.log(`[seed-rfi] Inserted ${pumpData.length} pump stations`);

  // =======================================================================
  // 5. INSPECTION RECORDS (点検記録)
  // =======================================================================
  console.log('[seed-rfi] Seeding inspection records...');

  const inspections = [
    // Hazardous cherry tree on Sakura-dori
    { assetType: 'street-tree', assetId: 'ST-007', date: '2024-11-20', type: 'detailed', result: 'critical', grade: 'D',
      findings: '幹の腐朽が進行、倒木の危険性あり', notes: '6ヶ月以内の伐採を推奨',
      inspector: '田中太郎', org: '名古屋市緑政土木局', lng: 136.9100, lat: 35.1710 },
    // Dead zelkova near Meijo
    { assetType: 'street-tree', assetId: 'ST-017', date: '2025-01-10', type: 'emergency', result: 'critical', grade: 'S',
      findings: '完全枯死確認、落枝の危険', notes: '早急な伐採・撤去が必要',
      inspector: '山本次郎', org: '北区緑政土木局', lng: 136.9060, lat: 35.1870 },
    // Leaking water fountain at Shiga Park
    { assetType: 'park-facility', assetId: 'PF-006', date: '2024-12-05', type: 'routine', result: 'needsRepair', grade: 'D',
      findings: '飲料水器のバルブ漏水、水槽にひび割れ', notes: '安全バリアを仮設置済み',
      inspector: '鈴木花子', org: '北区公園管理事務所', lng: 136.9044, lat: 35.2027 },
    // Damaged fence at Shiga Park
    { assetType: 'park-facility', assetId: 'PF-010', date: '2025-01-15', type: 'routine', result: 'needsRepair', grade: 'D',
      findings: '東側フェンスの支柱腐食、傾斜あり', notes: '児童の安全確保のため早期修繕が必要',
      inspector: '佐藤一郎', org: '北区公園管理事務所', lng: 136.9049, lat: 35.2023 },
    // Critical pavement on Hirokoji
    { assetType: 'pavement-section', assetId: 'PS-005', date: '2024-06-15', type: 'detailed', result: 'critical', grade: 'D',
      findings: 'MCI 4.2、ひび割れ率14.5%、わだち掘れ18mm', notes: '2026年度補修計画に計上済み',
      inspector: '高橋美咲', org: '緑政土木局道路維持課', lng: 136.9020, lat: 35.1680 },
    // Pump station under maintenance
    { assetType: 'pump-station', assetId: 'PUMP-003', date: '2024-10-01', type: 'detailed', result: 'needsRepair', grade: 'C',
      findings: 'ポンプ3号機のベアリング摩耗、配管腐食進行', notes: '部品交換中、2025年3月復旧予定',
      inspector: '渡辺健太', org: '上下水道局西管理事務所', lng: 136.8800, lat: 35.1990 },
  ];

  for (const insp of inspections) {
    const geom = point(insp.lng, insp.lat);
    await db.execute(sql`
      INSERT INTO inspection_records (
        event_id, road_asset_id, asset_type, asset_id,
        inspection_date, inspection_type, result, condition_grade,
        findings, notes, inspector, inspector_organization,
        geometry
      ) VALUES (
        ${null}, ${null}, ${insp.assetType}, ${insp.assetId},
        ${new Date(insp.date)}, ${insp.type}, ${insp.result}, ${insp.grade},
        ${insp.findings}, ${insp.notes},
        ${insp.inspector}, ${insp.org},
        ${toGeomSql(geom)}
      ) ON CONFLICT DO NOTHING
    `);
  }
  console.log(`[seed-rfi] Inserted ${inspections.length} inspection records`);

  // =======================================================================
  // 6. LIFECYCLE PLANS (長寿命化計画)
  // =======================================================================
  console.log('[seed-rfi] Seeding lifecycle plans...');

  const plans = [
    {
      id: 'LP-001',
      title: '志賀公園 トイレ棟（北）長寿命化計画',
      assetType: 'ParkFacility', assetRef: 'PF-001', baseline: 'B', designLife: 40, remaining: 25,
      interventions: [
        { year: 2028, type: 'repair', description: '外壁補修・防水処理', estimatedCostJpy: 2000000 },
        { year: 2035, type: 'renewal', description: '設備更新（配管・衛生機器）', estimatedCostJpy: 8000000 },
        { year: 2050, type: 'replacement', description: '建替え', estimatedCostJpy: 25000000 },
      ],
      total: '35000000', annual: '1166667',
    },
    {
      id: 'LP-002',
      title: '広小路通 納屋橋〜栄 舗装補修計画',
      assetType: 'PavementSection', assetRef: 'PS-005', baseline: 'D', designLife: 15, remaining: 2,
      interventions: [
        { year: 2026, type: 'repair', description: '部分打替え・オーバーレイ', estimatedCostJpy: 15000000 },
        { year: 2036, type: 'renewal', description: '全面舗装更新', estimatedCostJpy: 45000000 },
      ],
      total: '60000000', annual: '4000000',
    },
    {
      id: 'LP-003',
      title: '天白排水ポンプ場 設備更新計画',
      assetType: 'PumpStation', assetRef: 'PUMP-005', baseline: 'D', designLife: 30, remaining: 0,
      interventions: [
        { year: 2026, type: 'renewal', description: 'ポンプ本体・制御盤交換', estimatedCostJpy: 50000000 },
        { year: 2040, type: 'repair', description: '配管・バルブ更新', estimatedCostJpy: 20000000 },
        { year: 2055, type: 'replacement', description: '施設全面更新', estimatedCostJpy: 200000000 },
      ],
      total: '270000000', annual: '9000000',
    },
  ];

  for (const lp of plans) {
    await db.execute(sql`
      INSERT INTO lifecycle_plans (
        id, title, version, plan_start_year, plan_end_year, plan_status,
        asset_type, baseline_condition, design_life, remaining_life,
        interventions, total_lifecycle_cost_jpy, annual_average_cost_jpy,
        asset_ref, managing_dept, created_by
      ) VALUES (
        ${lp.id}, ${lp.title}, ${'v1.0'}, ${2025}, ${2055}, ${'approved'},
        ${lp.assetType}, ${lp.baseline}, ${lp.designLife}, ${lp.remaining},
        ${JSON.stringify(lp.interventions)}::jsonb, ${lp.total}, ${lp.annual},
        ${lp.assetRef}, ${'緑政土木局'}, ${'管理課長'}
      ) ON CONFLICT DO NOTHING
    `);
  }
  console.log(`[seed-rfi] Inserted ${plans.length} lifecycle plans`);

  // =======================================================================
  // Validation: verify FK refs resolve
  // =======================================================================
  console.log('[seed-rfi] Validating references...');

  const treeRefCheck = await db.execute<{ cnt: string }>(sql`
    SELECT COUNT(*)::text as cnt FROM street_tree_assets WHERE road_ref IS NOT NULL
      AND road_ref NOT IN (SELECT id FROM road_assets)
  `);
  const pfRefCheck = await db.execute<{ cnt: string }>(sql`
    SELECT COUNT(*)::text as cnt FROM park_facilities WHERE green_space_ref IS NOT NULL
      AND green_space_ref NOT IN (SELECT id FROM greenspace_assets)
  `);
  const psRefCheck = await db.execute<{ cnt: string }>(sql`
    SELECT COUNT(*)::text as cnt FROM pavement_sections WHERE road_ref IS NOT NULL
      AND road_ref NOT IN (SELECT id FROM road_assets)
  `);
  const pumpRefCheck = await db.execute<{ cnt: string }>(sql`
    SELECT COUNT(*)::text as cnt FROM pump_stations WHERE river_ref IS NOT NULL
      AND river_ref NOT IN (SELECT id FROM river_assets)
  `);

  const orphanedTrees = Number(treeRefCheck.rows[0]?.cnt || 0);
  const orphanedFacilities = Number(pfRefCheck.rows[0]?.cnt || 0);
  const orphanedPavements = Number(psRefCheck.rows[0]?.cnt || 0);
  const orphanedPumps = Number(pumpRefCheck.rows[0]?.cnt || 0);

  if (orphanedTrees + orphanedFacilities + orphanedPavements + orphanedPumps > 0) {
    console.warn(`[seed-rfi] WARNING: Orphaned refs found: trees=${orphanedTrees}, facilities=${orphanedFacilities}, pavements=${orphanedPavements}, pumps=${orphanedPumps}`);
  } else {
    console.log('[seed-rfi] All references validated successfully');
  }

  console.log('[seed-rfi] RFI seed complete!');
  console.log('[seed-rfi] Summary:');
  console.log(`  Street Trees:       ${treeData.length}`);
  console.log(`  Park Facilities:    ${facilityData.length}`);
  console.log(`  Pavement Sections:  ${pavementData.length}`);
  console.log(`  Pump Stations:      ${pumpData.length}`);
  console.log(`  Inspection Records: ${inspections.length}`);
  console.log(`  Lifecycle Plans:    ${plans.length}`);
}

seedRfi()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-rfi] Seed failed:', err);
    process.exit(1);
  });
