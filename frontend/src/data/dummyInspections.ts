/**
 * Dummy inspection history data for demo.
 * Generated from DUMMY_PARK_FACILITIES to ensure facility IDs match.
 */
import { DUMMY_PARK_FACILITIES } from './dummyParkFacilities';
import { DUMMY_FACILITIES } from './dummyFacilities';
import { DUMMY_CASES } from './dummyCases';

export interface DummyInspection {
  id: string;
  facilityId: string;
  date: string;
  inspector: string;
  structureRank?: string;
  structureMaterialNotes?: string;
  wearRank?: string;
  wearMaterialNotes?: string;
  eventId?: string;
}

// Category-specific wear notes for realistic inspection data
const WEAR_NOTES: Record<string, string[]> = {
  combinedPlay: ['FRP劣化', '接合部摩耗', '塗装剥離', 'グリップ摩耗'],
  bench: ['座面摩耗', '木材腐食', '塗装劣化', 'ボルト緩み'],
  pergola: ['柱脚部腐食', '塗装剥離', '木材腐食', '接合部劣化'],
  slide: ['滑降面摩耗', '手すり塗装劣化', '着地部摩耗', 'ステンレス変色'],
  sandbox: ['砂流出', '縁石劣化', '排水不良', '砂量不足'],
  swing: ['チェーン摩耗', '座板劣化', '軸受摩耗', '塗装剥離'],
  gazebo: ['柱脚部腐食', '屋根劣化', '塗装剥離', '接合部緩み'],
  healthExercise: ['グリップ摩耗', '塗装劣化', 'スプリング劣化', '錆発生'],
  picnicTable: ['天板摩耗', '木材腐食', '脚部劣化', 'ボルト緩み'],
  pavement: ['ひび割れ', '段差発生', '沈下', '排水不良'],
  climbingGym: ['塗装剥離', '接合部摩耗', '錆発生', 'グリップ摩耗'],
  flowerBed: ['土壌流出', '縁石劣化', '排水不良', '植栽劣化'],
  toilet: ['配管劣化', '便器損傷', '壁面ひび割れ', '防水劣化'],
  parkLight: ['LED劣化', '灯具汚れ', 'ポール塗装劣化', '配線劣化'],
  fountain: ['ポンプ劣化', '水漏れ', '石材汚れ', '配管詰まり'],
  waterFountain: ['蛇口劣化', '配管腐食', '排水不良'],
  fence: ['支柱腐食', 'メッシュ変形', '基礎沈下'],
  bridge: ['床板腐食', '手すり劣化', '防腐処理劣化'],
  pond: ['防水劣化', '護岸劣化', '配管詰まり'],
  gardenPath: ['路面ひび割れ', '排水不良', '段差発生'],
  tennisCourt: ['人工芝摩耗', 'ライン劣化', '排水不良'],
  soccerField: ['芝生摩耗', 'ゴール劣化', '排水不良'],
  parking: ['舗装ひび割れ', '白線劣化', '排水不良'],
  bollard: ['塗装劣化', '反射材劣化', '傾き'],
  warehouse: ['扉建付け不良', '錆発生', '雨漏り'],
};

const STRUCTURE_NOTES: Record<string, string[]> = {
  combinedPlay: ['接合部腐食', '柱脚部劣化', '溶接部劣化'],
  bench: ['脚部腐食', '座面亀裂', '基礎劣化'],
  pergola: ['柱脚部腐食', '梁部腐食', '基礎ひび割れ'],
  slide: ['支柱腐食', '階段部劣化', '基礎沈下'],
  sandbox: ['枠材腐食', '基礎劣化'],
  swing: ['支柱腐食', '横梁劣化', '基礎沈下'],
  gazebo: ['柱脚部腐食', '屋根骨組劣化', '基礎ひび割れ'],
  healthExercise: ['支柱腐食', '接合部劣化', '基礎沈下'],
  picnicTable: ['脚部腐食', '天板亀裂', '基礎劣化'],
  pavement: ['基盤沈下', '路盤劣化', 'ひび割れ'],
  climbingGym: ['接合部腐食', '支柱劣化', '溶接部劣化'],
  flowerBed: ['枠材劣化', '基礎沈下'],
  toilet: ['柱脚部劣化', '基礎ひび割れ', '屋根劣化'],
  parkLight: ['ポール腐食', '基礎沈下', '接合部劣化'],
  fountain: ['躯体ひび割れ', '基礎沈下', '配管劣化'],
  waterFountain: ['本体腐食', '基礎劣化'],
  fence: ['支柱腐食', '基礎沈下'],
  bridge: ['主桁劣化', '橋脚腐食', '基礎沈下'],
  pond: ['護岸劣化', '底盤劣化'],
  gardenPath: ['路盤劣化', '基盤沈下'],
  tennisCourt: ['基盤沈下', 'フェンス劣化'],
  soccerField: ['排水設備劣化', '基盤沈下'],
  parking: ['基盤沈下', '路盤劣化'],
  bollard: ['本体腐食', '基礎沈下'],
  warehouse: ['柱脚部劣化', '基礎ひび割れ', '外壁劣化'],
};

const INSPECTORS = ['○○造園土木', '△△建設'];
const RANKS = ['A', 'A', 'B', 'B', 'C'];

// Deterministic dates for inspections
const DATES_1 = [
  '2025-07-29', '2025-06-15', '2025-09-01', '2025-05-01', '2025-08-15',
  '2025-03-05', '2025-07-10', '2025-04-01', '2025-06-01', '2025-10-01',
  '2025-08-01', '2025-05-15', '2025-09-15', '2025-07-01', '2025-04-15',
  '2025-06-20', '2025-03-10', '2025-11-01',
];
const DATES_2 = [
  '2024-07-15', '2024-11-10', '2024-09-01', '2024-10-20', '2024-12-05',
  '2024-08-10', '2024-11-20', '2024-09-15', '2024-12-01', '2024-10-01',
  '2024-07-01', '2024-11-15', '2024-08-15', '2024-12-15', '2024-09-10',
  '2024-10-15', '2024-07-20', '2024-11-05',
];

function buildInspections(): DummyInspection[] {
  const result: DummyInspection[] = [];
  let idCounter = 23001;

  DUMMY_PARK_FACILITIES.forEach((feature, idx) => {
    const fac = feature.properties;
    const cat = fac.category;
    const grade = fac.conditionGrade ?? 'B';

    // Inspection 1 (recent)
    const wearNotes1 = WEAR_NOTES[cat] ?? ['劣化'];
    const structNotes1 = STRUCTURE_NOTES[cat] ?? ['劣化'];
    const sRank1 = grade === 'C' ? 'C' : RANKS[idx % RANKS.length];
    const wRank1 = grade === 'C' ? 'C' : RANKS[(idx + 1) % RANKS.length];

    result.push({
      id: String(idCounter++),
      facilityId: fac.id,
      date: DATES_1[idx % DATES_1.length],
      inspector: INSPECTORS[idx % 2],
      structureRank: sRank1,
      structureMaterialNotes: sRank1 === 'C' ? structNotes1[idx % structNotes1.length] : '-',
      wearRank: wRank1,
      wearMaterialNotes: wRank1 >= 'C' ? wearNotes1[idx % wearNotes1.length] : '-',
    });

    // Inspection 2 (older)
    const sRank2 = RANKS[(idx + 2) % RANKS.length];
    const wRank2 = RANKS[(idx + 3) % RANKS.length];

    result.push({
      id: String(idCounter++),
      facilityId: fac.id,
      date: DATES_2[idx % DATES_2.length],
      inspector: INSPECTORS[(idx + 1) % 2],
      structureRank: sRank2,
      structureMaterialNotes: sRank2 === 'C' ? structNotes1[(idx + 1) % structNotes1.length] : '-',
      wearRank: wRank2,
      wearMaterialNotes: wRank2 >= 'C' ? wearNotes1[(idx + 1) % wearNotes1.length] : '-',
    });
  });

  // --- Curated facilities (from dummyFacilities.ts) ---
  DUMMY_FACILITIES.forEach((fac, idx) => {
    const cat = fac.category;
    const grade = fac.conditionGrade ?? 'B';

    const wearNotes1 = WEAR_NOTES[cat] ?? ['劣化'];
    const structNotes1 = STRUCTURE_NOTES[cat] ?? ['劣化'];
    const sRank1 = grade === 'C' ? 'C' : RANKS[idx % RANKS.length];
    const wRank1 = grade === 'C' ? 'C' : RANKS[(idx + 1) % RANKS.length];

    result.push({
      id: String(idCounter++),
      facilityId: fac.id,
      date: fac.lastInspectionDate ?? DATES_1[idx % DATES_1.length],
      inspector: INSPECTORS[idx % 2],
      structureRank: fac.structureRank ?? sRank1,
      structureMaterialNotes: (fac.structureRank ?? sRank1) >= 'C' ? structNotes1[idx % structNotes1.length] : '-',
      wearRank: fac.wearRank ?? wRank1,
      wearMaterialNotes: (fac.wearRank ?? wRank1) >= 'C' ? wearNotes1[idx % wearNotes1.length] : '-',
    });

    // Older inspection
    const sRank2 = RANKS[(idx + 2) % RANKS.length];
    const wRank2 = RANKS[(idx + 3) % RANKS.length];

    result.push({
      id: String(idCounter++),
      facilityId: fac.id,
      date: DATES_2[idx % DATES_2.length],
      inspector: INSPECTORS[(idx + 1) % 2],
      structureRank: sRank2,
      structureMaterialNotes: sRank2 === 'C' ? structNotes1[(idx + 1) % structNotes1.length] : '-',
      wearRank: wRank2,
      wearMaterialNotes: wRank2 >= 'C' ? wearNotes1[(idx + 1) % wearNotes1.length] : '-',
    });
  });

  // Link inspections to inspection-type cases by matching facilityRef
  const inspCases = DUMMY_CASES.filter((c) => c.type === 'inspection');
  for (const c of inspCases) {
    const insp = result.find((i) => i.facilityId === c.facilityRef && !i.eventId);
    if (insp) {
      insp.id = String(c.id);
      insp.eventId = String(c.id);
    }
  }

  return result;
}

export const DUMMY_INSPECTIONS: DummyInspection[] = buildInspections();

/** Get inspections for a specific facility */
export function getDummyInspectionsByFacility(facilityId: string): DummyInspection[] {
  return DUMMY_INSPECTIONS.filter((i) => i.facilityId === facilityId);
}

