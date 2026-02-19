/**
 * Curated dummy facility data for demo when backend API is unavailable.
 * Facilities are grouped by park (greenSpaceRef) using real DB park IDs.
 */

export interface DummyFacility {
  id: string;
  facilityId: string;
  name: string;
  description?: string;
  category: string;
  facilityClassification?: string; // 施設分類 (rest, play, convenience, etc.)
  subCategory?: string;
  subItem?: string; // 細目
  subItemDetail?: string; // 細目補足
  material?: string;
  mainMaterial?: string; // 主要部材
  quantity?: number;
  dateInstalled?: string;
  designLife?: number; // 経過年数 (calculated from dateInstalled)
  manufacturer?: string;
  installer?: string; // 設置業者
  conditionGrade?: string;
  structureRank?: string; // 構造ランク (A, B, C, D)
  wearRank?: string; // 消耗ランク (A, B, C, D)
  safetyConcern?: boolean;
  lastInspectionDate?: string; // 最近点検日
  nextInspectionDate?: string;
  lastRepairDate?: string; // 直近修理日
  managementType?: string; // 管理種別
  urgencyLevel?: string; // 緊急度判定 (high, medium, low)
  countermeasure?: string; // 対策内容
  plannedYear?: number; // 実施予定年
  estimatedCost?: number; // 概算費用
  designDocNumber?: string; // 設計書番号
  notes?: string; // 備考
  status: string;
  ward: string;
  greenSpaceRef: string;
}

export const DUMMY_FACILITIES: DummyFacility[] = [
  // 鶴舞公園 (GS-zxpnkee2)
  { id: 'PF-demo-001', facilityId: '03-210', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '1998-04-01', quantity: 1, designLife: 28, lastInspectionDate: '2025-06-15', lastRepairDate: '2023-04-10', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2028, estimatedCost: 3200000, notes: '' },
  { id: 'PF-demo-002', facilityId: '03-220', name: '遊具広場', category: 'playground', facilityClassification: 'play', subItem: 'スチール・FRP', mainMaterial: 'スチール', quantity: 8, conditionGrade: 'C', structureRank: 'C', wearRank: 'C', safetyConcern: true, status: 'underRepair', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2005-03-01', designLife: 21, lastInspectionDate: '2025-09-01', lastRepairDate: '2025-10-01', managementType: '予防保全', urgencyLevel: 'high', countermeasure: '更新', plannedYear: 2026, estimatedCost: 8500000, notes: '安全懸念あり' },
  { id: 'PF-demo-003', facilityId: '03-230', name: 'ベンチ群A', category: 'bench', facilityClassification: 'rest', subItem: '背付き', mainMaterial: '木製', quantity: 12, conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'suspended', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2010-04-01', designLife: 16, lastInspectionDate: '2025-06-15', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2027, estimatedCost: 1474000, notes: '' },
  { id: 'PF-demo-004', facilityId: '03-240', name: '東屋', category: 'shelter', facilityClassification: 'rest', subItem: '四阿', mainMaterial: '木製', conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2015-10-01', quantity: 1, designLife: 10, lastInspectionDate: '2025-06-15', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 2100000, notes: '' },
  { id: 'PF-demo-005', facilityId: '03-250', name: '照明設備A', category: 'lighting', facilityClassification: 'management', subItem: 'LED', mainMaterial: 'アルミ', quantity: 24, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2020-03-01', designLife: 6, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 960000, notes: '' },

  // 名城公園 (GS-nliigh01) — matches Figma design
  { id: 'PF-demo-011', facilityId: '05-780', name: 'テーブル', category: 'bench', facilityClassification: 'rest', subItem: '木製', mainMaterial: '金属(ステンレス以外)', quantity: 3, structureRank: 'A', wearRank: 'C', status: 'active', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2015-03-05', designLife: 28, lastInspectionDate: '2015-03-05', lastRepairDate: '2015/03/05', managementType: '予防保全', urgencyLevel: 'high', countermeasure: '更新', plannedYear: 2027, estimatedCost: 1474000, notes: '国庫補助Aゾーン（テーブル3×ベ…' },
  { id: 'PF-demo-012', facilityId: '05-760', name: 'ベンチ', category: 'bench', facilityClassification: 'rest', subItem: '背付き', mainMaterial: '再生木材', quantity: 4, structureRank: 'A', wearRank: 'D', status: 'underRepair', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2015-03-05', designLife: 28, lastInspectionDate: '2015-03-05', lastRepairDate: '2015/03/05', managementType: '予防保全', urgencyLevel: 'high', countermeasure: '更新', plannedYear: 2027, estimatedCost: 1474000, notes: '国庫補助Aゾーン（テーブル3×ベ…' },
  { id: 'PF-demo-013', facilityId: '05-710', name: 'パーゴラ', category: 'shelter', facilityClassification: 'rest', subItem: '藤棚', mainMaterial: 'コンクリート', quantity: 1, structureRank: 'C', wearRank: 'C', status: 'suspended', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '1991-03-31', designLife: 28, lastInspectionDate: '2015-03-05', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2027, estimatedCost: 1474000, notes: '国庫補助Aゾーン（テーブル3×ベ…' },
  { id: 'PF-demo-014', facilityId: '05-790', name: '水飲み場', category: 'waterFountain', facilityClassification: 'convenience', subItem: 'ステンレス', mainMaterial: 'ステンレス', quantity: 3, structureRank: 'A', wearRank: 'A', status: 'active', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2018-04-01', designLife: 8, lastInspectionDate: '2025-07-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2033, estimatedCost: 480000, notes: '' },

  // 東山動植物園 (GS-4g77l6x7)
  { id: 'PF-demo-021', facilityId: '01-310', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2000-04-01', quantity: 1, designLife: 26, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2030, estimatedCost: 3200000, notes: '' },
  { id: 'PF-demo-022', facilityId: '01-320', name: 'ベンチ群A', category: 'bench', facilityClassification: 'rest', subItem: '背無し', mainMaterial: '木製', quantity: 20, conditionGrade: 'C', structureRank: 'C', wearRank: 'C', status: 'suspended', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2005-04-01', designLife: 21, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2027, estimatedCost: 2400000, notes: '' },
  { id: 'PF-demo-023', facilityId: '01-330', name: '案内板', category: 'signBoard', facilityClassification: 'management', subItem: 'アルミ製', mainMaterial: 'アルミ', quantity: 6, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2019-04-01', designLife: 7, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2034, estimatedCost: 360000, notes: '' },

  // 白川公園 (GS-es1u7z8r)
  { id: 'PF-demo-031', facilityId: '09-410', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '2015-04-01', quantity: 1, designLife: 11, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2045, estimatedCost: 3200000, notes: '' },
  { id: 'PF-demo-032', facilityId: '09-420', name: '照明設備A', category: 'lighting', facilityClassification: 'management', subItem: 'LED', mainMaterial: 'アルミ', quantity: 16, conditionGrade: 'A', structureRank: 'A', wearRank: 'B', status: 'underRepair', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '2020-04-01', designLife: 6, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 640000, notes: '' },
  { id: 'PF-demo-033', facilityId: '09-430', name: '舗装路', category: 'pavement', facilityClassification: 'management', subItem: 'インターロッキング', mainMaterial: 'コンクリート', conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '2015-04-01', quantity: 1, designLife: 11, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 1200000, notes: '' },

  // 庄内緑地公園 (GS-9ego0pvp)
  { id: 'PF-demo-041', facilityId: '05-510', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'suspended', ward: '西区', greenSpaceRef: 'GS-9ego0pvp', dateInstalled: '2003-04-01', quantity: 1, designLife: 23, lastInspectionDate: '2025-06-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 3200000, notes: '' },
  { id: 'PF-demo-042', facilityId: '05-520', name: 'スポーツ広場', category: 'sportsFacility', facilityClassification: 'exercise', subItem: '人工芝', mainMaterial: '合成樹脂', conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '西区', greenSpaceRef: 'GS-9ego0pvp', dateInstalled: '2018-04-01', quantity: 1, designLife: 8, lastInspectionDate: '2025-06-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2033, estimatedCost: 5600000, notes: '' },

  // 大高緑地公園 (GS-auy42b1p)
  { id: 'PF-demo-051', facilityId: '13-610', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'C', structureRank: 'C', wearRank: 'C', status: 'underRepair', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '1995-04-01', quantity: 1, designLife: 31, lastInspectionDate: '2025-04-01', managementType: '予防保全', urgencyLevel: 'high', countermeasure: '更新', plannedYear: 2026, estimatedCost: 4800000, notes: '' },
  { id: 'PF-demo-052', facilityId: '13-620', name: '遊具広場', category: 'playground', facilityClassification: 'play', subItem: '複合遊具', mainMaterial: 'スチール・FRP', quantity: 12, conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '2010-04-01', designLife: 16, lastInspectionDate: '2025-04-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2030, estimatedCost: 8500000, notes: '' },
  { id: 'PF-demo-053', facilityId: '13-630', name: '東屋A', category: 'shelter', facilityClassification: 'rest', subItem: '四阿', mainMaterial: '木製', conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'suspended', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '2008-04-01', quantity: 1, designLife: 18, lastInspectionDate: '2025-04-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 2100000, notes: '' },

  // 久屋大通公園 (GS-byrogagk)
  { id: 'PF-demo-061', facilityId: '11-710', name: '照明設備A', category: 'lighting', facilityClassification: 'management', subItem: 'LED', mainMaterial: 'アルミ', quantity: 40, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', designLife: 5, lastInspectionDate: '2025-09-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 1600000, notes: '' },
  { id: 'PF-demo-062', facilityId: '11-720', name: 'ベンチ群', category: 'bench', facilityClassification: 'rest', subItem: '背付き', mainMaterial: '木製・スチール', quantity: 30, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'underRepair', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', designLife: 5, lastInspectionDate: '2025-09-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 3600000, notes: '' },
  { id: 'PF-demo-063', facilityId: '11-730', name: '舗装路', category: 'pavement', facilityClassification: 'management', subItem: 'インターロッキング', mainMaterial: 'コンクリート', conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', quantity: 1, designLife: 5, lastInspectionDate: '2025-09-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2040, estimatedCost: 2400000, notes: '' },
];

/** Get all dummy facilities */
export function getAllDummyFacilities() {
  return DUMMY_FACILITIES;
}

/** Get dummy facilities for a specific park */
export function getDummyFacilitiesByPark(parkId: string) {
  return DUMMY_FACILITIES.filter((f) => f.greenSpaceRef === parkId);
}

/** Get a single dummy facility by ID */
export function getDummyFacility(id: string) {
  return DUMMY_FACILITIES.find((f) => f.id === id) ?? null;
}

/** Category labels for display */
export const FACILITY_CATEGORY_LABELS: Record<string, string> = {
  playground: '遊具', bench: 'ベンチ', shelter: '東屋', toilet: 'トイレ',
  fence: 'フェンス', gate: '門', lighting: '照明', drainage: '排水設備',
  waterFountain: '水飲み場', signBoard: '案内板', pavement: '園路',
  sportsFacility: 'スポーツ施設', building: '建物', other: 'その他',
};

/** Facility classification labels (施設分類) */
export const FACILITY_CLASSIFICATION_LABELS: Record<string, string> = {
  rest: '休養', play: '遊戯', convenience: '便益', landscaping: '修景',
  management: '管理', exercise: '運動', education: '教養',
};

/** Status labels and badge styles */
export const FACILITY_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: '使用中', className: 'bg-[#22C55E] text-white' },
  underRepair: { label: '修理中', className: 'bg-[#FACC15] text-[#713F12]' },
  suspended: { label: '停止使用', className: 'bg-[#F87171] text-[#7F1D1D]' },
};
