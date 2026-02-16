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
  subCategory?: string;
  material?: string;
  quantity?: number;
  dateInstalled?: string;
  designLife?: number;
  manufacturer?: string;
  conditionGrade?: string;
  safetyConcern?: boolean;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  status: string;
  ward: string;
  greenSpaceRef: string;
}

export const DUMMY_FACILITIES: DummyFacility[] = [
  // 鶴舞公園 (GS-zxpnkee2)
  { id: 'PF-demo-001', facilityId: 'T-001', name: '鶴舞公園 トイレA棟', category: 'toilet', material: 'RC造', conditionGrade: 'B', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '1998-04-01', designLife: 40, lastInspectionDate: '2025-06-15', nextInspectionDate: '2026-06-15' },
  { id: 'PF-demo-002', facilityId: 'T-002', name: '鶴舞公園 遊具広場', category: 'playground', material: 'スチール・FRP', quantity: 8, conditionGrade: 'C', safetyConcern: true, status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2005-03-01', designLife: 20, lastInspectionDate: '2025-09-01', nextInspectionDate: '2026-03-01' },
  { id: 'PF-demo-003', facilityId: 'T-003', name: '鶴舞公園 ベンチ群A', category: 'bench', material: '木製', quantity: 12, conditionGrade: 'B', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2010-04-01', designLife: 15, lastInspectionDate: '2025-06-15' },
  { id: 'PF-demo-004', facilityId: 'T-004', name: '鶴舞公園 東屋', category: 'shelter', material: '木造', conditionGrade: 'A', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2015-10-01', designLife: 30, lastInspectionDate: '2025-06-15' },
  { id: 'PF-demo-005', facilityId: 'T-005', name: '鶴舞公園 照明設備A', category: 'lighting', material: 'LED', quantity: 24, conditionGrade: 'A', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2020-03-01', designLife: 15, lastInspectionDate: '2025-08-01' },

  // 名城公園 (GS-nliigh01)
  { id: 'PF-demo-011', facilityId: 'M-001', name: '名城公園 トイレA棟', category: 'toilet', material: 'RC造', conditionGrade: 'A', status: 'active', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2010-04-01', designLife: 40, lastInspectionDate: '2025-07-01' },
  { id: 'PF-demo-012', facilityId: 'M-002', name: '名城公園 遊具広場', category: 'playground', material: 'スチール・FRP', quantity: 5, conditionGrade: 'B', status: 'active', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2012-03-01', designLife: 20, lastInspectionDate: '2025-07-01' },
  { id: 'PF-demo-013', facilityId: 'M-003', name: '名城公園 フェンスA', category: 'fence', material: 'スチール', conditionGrade: 'B', status: 'active', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2008-04-01', designLife: 25, lastInspectionDate: '2025-07-01' },
  { id: 'PF-demo-014', facilityId: 'M-004', name: '名城公園 水飲み場', category: 'waterFountain', material: 'ステンレス', quantity: 3, conditionGrade: 'A', status: 'active', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2018-04-01', designLife: 20, lastInspectionDate: '2025-07-01' },

  // 東山動植物園 (GS-4g77l6x7)
  { id: 'PF-demo-021', facilityId: 'H-001', name: '東山公園 トイレA棟', category: 'toilet', material: 'RC造', conditionGrade: 'B', status: 'active', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2000-04-01', designLife: 40, lastInspectionDate: '2025-05-01' },
  { id: 'PF-demo-022', facilityId: 'H-002', name: '東山公園 ベンチ群A', category: 'bench', material: '木製', quantity: 20, conditionGrade: 'C', status: 'active', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2005-04-01', designLife: 15, lastInspectionDate: '2025-05-01' },
  { id: 'PF-demo-023', facilityId: 'H-003', name: '東山公園 案内板', category: 'signBoard', material: 'アルミ', quantity: 6, conditionGrade: 'A', status: 'active', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2019-04-01', designLife: 10, lastInspectionDate: '2025-05-01' },

  // 白川公園 (GS-es1u7z8r)
  { id: 'PF-demo-031', facilityId: 'S-001', name: '白川公園 トイレA棟', category: 'toilet', material: 'RC造', conditionGrade: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '2015-04-01', designLife: 40, lastInspectionDate: '2025-08-01' },
  { id: 'PF-demo-032', facilityId: 'S-002', name: '白川公園 照明設備A', category: 'lighting', material: 'LED', quantity: 16, conditionGrade: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '2020-04-01', designLife: 15, lastInspectionDate: '2025-08-01' },
  { id: 'PF-demo-033', facilityId: 'S-003', name: '白川公園 舗装路', category: 'pavement', material: 'インターロッキング', conditionGrade: 'B', status: 'active', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '2015-04-01', designLife: 20, lastInspectionDate: '2025-08-01' },

  // 庄内緑地公園 (GS-9ego0pvp)
  { id: 'PF-demo-041', facilityId: 'SN-001', name: '庄内緑地 トイレA棟', category: 'toilet', material: 'RC造', conditionGrade: 'B', status: 'active', ward: '西区', greenSpaceRef: 'GS-9ego0pvp', dateInstalled: '2003-04-01', designLife: 40, lastInspectionDate: '2025-06-01' },
  { id: 'PF-demo-042', facilityId: 'SN-002', name: '庄内緑地 スポーツ広場', category: 'sportsFacility', material: '人工芝', conditionGrade: 'A', status: 'active', ward: '西区', greenSpaceRef: 'GS-9ego0pvp', dateInstalled: '2018-04-01', designLife: 10, lastInspectionDate: '2025-06-01' },

  // 大高緑地公園 (GS-auy42b1p)
  { id: 'PF-demo-051', facilityId: 'OT-001', name: '大高緑地 トイレA棟', category: 'toilet', material: 'RC造', conditionGrade: 'C', status: 'active', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '1995-04-01', designLife: 40, lastInspectionDate: '2025-04-01' },
  { id: 'PF-demo-052', facilityId: 'OT-002', name: '大高緑地 遊具広場', category: 'playground', material: 'スチール・FRP', quantity: 12, conditionGrade: 'B', status: 'active', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '2010-04-01', designLife: 20, lastInspectionDate: '2025-04-01' },
  { id: 'PF-demo-053', facilityId: 'OT-003', name: '大高緑地 東屋A', category: 'shelter', material: '木造', conditionGrade: 'B', status: 'active', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '2008-04-01', designLife: 30, lastInspectionDate: '2025-04-01' },

  // 久屋大通公園 (GS-byrogagk)
  { id: 'PF-demo-061', facilityId: 'HO-001', name: '久屋大通 照明設備A', category: 'lighting', material: 'LED', quantity: 40, conditionGrade: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', designLife: 15, lastInspectionDate: '2025-09-01' },
  { id: 'PF-demo-062', facilityId: 'HO-002', name: '久屋大通 ベンチ群', category: 'bench', material: '木製・スチール', quantity: 30, conditionGrade: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', designLife: 15, lastInspectionDate: '2025-09-01' },
  { id: 'PF-demo-063', facilityId: 'HO-003', name: '久屋大通 舗装路', category: 'pavement', material: 'インターロッキング', conditionGrade: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', designLife: 20, lastInspectionDate: '2025-09-01' },
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
