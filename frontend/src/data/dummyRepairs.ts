/**
 * Dummy repair history data for demo.
 * Generated from DUMMY_PARK_FACILITIES to ensure facility IDs match.
 */
import { DUMMY_PARK_FACILITIES } from './dummyParkFacilities';
import { DUMMY_FACILITIES } from './dummyFacilities';
import { DUMMY_CASES } from './dummyCases';

export interface DummyRepair {
  id: string;
  facilityId: string;
  date: string;
  type: string;
  description: string;
  caseId?: string;
  mainReplacementParts?: string;
  vendor?: string;
  repairNotes?: string;
  designDocNumber?: string;
}

// Category-specific repair descriptions
const REPAIR_TEMPLATES: Record<string, Array<{ type: string; desc: string; parts?: string; notes?: string }>> = {
  combinedPlay: [
    { type: '部品交換', desc: '複合遊具の接合ボルト交換', parts: 'ボルト・ナット類', notes: '定期点検対応' },
    { type: '塗装', desc: '複合遊具の防錆塗装', parts: '塗料', notes: '塗膜劣化対応' },
  ],
  bench: [
    { type: '部品交換', desc: 'ベンチ座面板交換', parts: '木製座板', notes: '座面摩耗対応' },
    { type: '塗装', desc: 'ベンチ防腐塗装', parts: '防腐塗料', notes: '定期塗装' },
  ],
  pergola: [
    { type: '木材交換', desc: 'パーゴラ柱部分交換', parts: '木材・接合金具', notes: '柱脚部腐食対応' },
    { type: '塗装', desc: 'パーゴラ防錆塗装', parts: '塗料', notes: '定期塗装' },
  ],
  slide: [
    { type: '部品交換', desc: 'すべり台の踊り場デッキ交換', parts: 'デッキ材', notes: '摩耗対応' },
    { type: '安全対策', desc: 'すべり台の手すり補強', parts: '手すり部材', notes: '安全点検対応' },
  ],
  sandbox: [
    { type: '補修', desc: '砂場砂入替え・柵補修', parts: '珪砂・柵材', notes: '定期入替え' },
    { type: '補修', desc: '砂場縁石補修', parts: '縁石材', notes: '縁石劣化対応' },
  ],
  swing: [
    { type: '部品交換', desc: 'ブランコ座面チェーン交換', parts: 'チェーン・座板', notes: '摩耗対応' },
    { type: '塗装', desc: 'ブランコ支柱防錆塗装', parts: '塗料', notes: '定期塗装' },
  ],
  gazebo: [
    { type: '補修', desc: 'シェルター屋根補修', parts: '屋根材', notes: '屋根劣化対応' },
    { type: '塗装', desc: 'シェルター防錆塗装', parts: '塗料', notes: '定期塗装' },
  ],
  healthExercise: [
    { type: '部品交換', desc: '健康器具のグリップ交換', parts: 'グリップ材', notes: '摩耗対応' },
    { type: '塗装', desc: '健康器具防錆塗装', parts: '塗料', notes: '定期塗装' },
  ],
  picnicTable: [
    { type: '部品交換', desc: '野外卓天板交換', parts: '木製天板', notes: '天板摩耗対応' },
    { type: '塗装', desc: '野外卓防腐塗装', parts: '防腐塗料', notes: '定期塗装' },
  ],
  pavement: [
    { type: '舗装補修', desc: '舗装ひび割れ補修', parts: '補修材', notes: 'ひび割れ対応' },
    { type: '舗装補修', desc: '舗装部分補修（沈下箇所）', parts: '舗装材', notes: '沈下対応' },
  ],
  climbingGym: [
    { type: '塗装', desc: 'ジャングルジム防錆塗装', parts: '塗料', notes: '錆発生対応' },
    { type: '溶接補修', desc: 'ジャングルジム接合部溶接補修', parts: '溶接材', notes: '接合部劣化対応' },
  ],
  flowerBed: [
    { type: '補修', desc: '花壇縁石補修', parts: '縁石材・土', notes: '縁石劣化対応' },
    { type: '補修', desc: '花壇土壌入替え', parts: '培養土', notes: '土壌流出対応' },
  ],
  toilet: [
    { type: '補修', desc: 'トイレ配管補修', parts: '配管部材', notes: '配管劣化対応' },
    { type: '部品交換', desc: 'トイレ便器交換', parts: '便器・部品', notes: '損傷対応' },
  ],
  parkLight: [
    { type: '部品交換', desc: '公園灯LED灯具交換', parts: 'LED灯具', notes: '定期交換' },
    { type: '塗装', desc: '公園灯ポール防錆塗装', parts: '塗料', notes: '塗装劣化対応' },
  ],
  fountain: [
    { type: '部品交換', desc: '噴水ポンプ交換', parts: '循環ポンプ', notes: 'ポンプ劣化対応' },
    { type: '補修', desc: '噴水配管補修', parts: '配管部材', notes: '水漏れ対応' },
  ],
  waterFountain: [
    { type: '部品交換', desc: '水飲み場蛇口交換', parts: '蛇口・バルブ', notes: '蛇口劣化対応' },
    { type: '補修', desc: '水飲み場排水補修', parts: '排水部材', notes: '排水不良対応' },
  ],
  fence: [
    { type: '補修', desc: 'フェンス支柱補修', parts: '支柱・金具', notes: '腐食対応' },
    { type: '部品交換', desc: 'フェンスメッシュ交換', parts: 'メッシュパネル', notes: '変形対応' },
  ],
  bridge: [
    { type: '補修', desc: '橋梁床板補修', parts: '木材・防腐剤', notes: '床板腐食対応' },
    { type: '塗装', desc: '橋梁防腐塗装', parts: '防腐塗料', notes: '定期塗装' },
  ],
  pond: [
    { type: '補修', desc: '池護岸補修', parts: 'コンクリート', notes: '護岸劣化対応' },
    { type: '補修', desc: '池底防水補修', parts: '防水材', notes: '漏水対応' },
  ],
  gardenPath: [
    { type: '舗装補修', desc: '園路舗装補修', parts: '舗装材', notes: 'ひび割れ対応' },
    { type: '舗装補修', desc: '園路排水補修', parts: '排水部材', notes: '排水不良対応' },
  ],
  tennisCourt: [
    { type: '補修', desc: 'テニスコート人工芝補修', parts: '人工芝材', notes: '摩耗対応' },
    { type: '補修', desc: 'テニスコートライン再施工', parts: 'ライン材', notes: 'ライン劣化対応' },
  ],
  soccerField: [
    { type: '補修', desc: 'サッカー場芝補修', parts: '芝生・土壌', notes: '芝生摩耗対応' },
    { type: '部品交換', desc: 'サッカーゴール補修', parts: 'ゴール部材', notes: 'ゴール劣化対応' },
  ],
  parking: [
    { type: '舗装補修', desc: '駐車場舗装補修', parts: 'アスファルト', notes: 'ひび割れ対応' },
    { type: '補修', desc: '駐車場白線再施工', parts: '塗料', notes: '白線劣化対応' },
  ],
  bollard: [
    { type: '塗装', desc: '車止め防錆塗装', parts: '塗料', notes: '錆発生対応' },
    { type: '補修', desc: '車止め傾き補修', parts: '基礎材', notes: '傾き対応' },
  ],
  warehouse: [
    { type: '補修', desc: '倉庫扉補修', parts: '扉金具', notes: '建付け不良対応' },
    { type: '塗装', desc: '倉庫外壁防錆塗装', parts: '塗料', notes: '錆発生対応' },
  ],
};

const VENDORS = ['○○造園土木', '△△建設'];

// Deterministic dates for repairs
const REPAIR_DATES_1 = [
  '2025-03-10', '2025-06-20', '2025-04-05', '2025-01-15', '2025-09-05',
  '2025-05-12', '2025-07-03', '2025-08-20', '2025-02-28', '2025-10-10',
  '2025-04-10', '2025-07-15', '2025-11-01', '2025-06-01', '2025-08-01',
  '2025-09-15', '2025-03-25', '2025-12-01',
];
const REPAIR_DATES_2 = [
  '2024-08-22', '2024-09-15', '2024-11-05', '2024-10-10', '2024-12-01',
  '2024-07-20', '2024-11-15', '2024-08-10', '2024-09-25', '2024-10-20',
  '2024-12-15', '2024-07-05', '2024-11-01', '2024-08-15', '2024-09-10',
  '2024-10-01', '2024-12-10', '2024-07-15',
];

function buildRepairs(): DummyRepair[] {
  const result: DummyRepair[] = [];
  let repCounter = 1;

  DUMMY_PARK_FACILITIES.forEach((feature, idx) => {
    const fac = feature.properties;
    const cat = fac.category;
    const templates = REPAIR_TEMPLATES[cat] ?? [
      { type: '補修', desc: `${cat}補修`, notes: '定期補修' },
    ];

    // Repair 1
    const t1 = templates[0];
    const docNum = `24-${String(repCounter).padStart(4, '0')}-K`;
    result.push({
      id: `REP-${String(repCounter++).padStart(3, '0')}`,
      facilityId: fac.id,
      date: REPAIR_DATES_1[idx % REPAIR_DATES_1.length],
      type: t1.type,
      description: t1.desc,
      mainReplacementParts: t1.parts,
      vendor: VENDORS[idx % 2],
      repairNotes: t1.notes,
      designDocNumber: docNum,
    });

    // Repair 2 (only for facilities with condition C or every other facility)
    if (fac.conditionGrade === 'C' || idx % 2 === 0) {
      const t2 = templates[templates.length > 1 ? 1 : 0];
      result.push({
        id: `REP-${String(repCounter++).padStart(3, '0')}`,
        facilityId: fac.id,
        date: REPAIR_DATES_2[idx % REPAIR_DATES_2.length],
        type: t2.type,
        description: t2.desc,
        mainReplacementParts: t2.parts,
        vendor: VENDORS[(idx + 1) % 2],
        repairNotes: t2.notes,
      });
    }
  });

  // --- Curated facilities (from dummyFacilities.ts) ---
  DUMMY_FACILITIES.forEach((fac, idx) => {
    const cat = fac.category;
    const templates = REPAIR_TEMPLATES[cat] ?? [
      { type: '補修', desc: `${fac.name}補修`, notes: '定期補修' },
    ];

    // Repair 1
    const t1 = templates[0];
    const docNum = `24-${String(repCounter).padStart(4, '0')}-K`;
    result.push({
      id: `REP-${String(repCounter++).padStart(3, '0')}`,
      facilityId: fac.id,
      date: fac.lastRepairDate ?? REPAIR_DATES_1[idx % REPAIR_DATES_1.length],
      type: t1.type,
      description: t1.desc,
      mainReplacementParts: t1.parts,
      vendor: VENDORS[idx % 2],
      repairNotes: t1.notes,
      designDocNumber: docNum,
    });

    // Repair 2 (for facilities with condition C or every other)
    if (fac.conditionGrade === 'C' || idx % 2 === 0) {
      const t2 = templates[templates.length > 1 ? 1 : 0];
      result.push({
        id: `REP-${String(repCounter++).padStart(3, '0')}`,
        facilityId: fac.id,
        date: REPAIR_DATES_2[idx % REPAIR_DATES_2.length],
        type: t2.type,
        description: t2.desc,
        mainReplacementParts: t2.parts,
        vendor: VENDORS[(idx + 1) % 2],
        repairNotes: t2.notes,
      });
    }
  });

  // Link repairs to repair-type cases by facilityRef
  const repairCases = DUMMY_CASES.filter((c) => c.type === 'repair');
  for (const c of repairCases) {
    const rep = result.find((r) => r.facilityId === c.facilityRef && !r.caseId);
    if (rep) {
      rep.id = String(c.id);
      rep.caseId = String(c.id);
    }
  }

  return result;
}

export const DUMMY_REPAIRS: DummyRepair[] = buildRepairs();

/** Get repairs for a specific facility */
export function getDummyRepairsByFacility(facilityId: string): DummyRepair[] {
  return DUMMY_REPAIRS.filter((r) => r.facilityId === facilityId);
}

/** Get the facility ID linked to a given event/case ID */
export function getFacilityIdByEventId(eventId: string): string | null {
  const repair = DUMMY_REPAIRS.find((r) => r.caseId === eventId);
  return repair?.facilityId ?? null;
}

