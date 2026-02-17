/**
 * Dummy construction event data for demo.
 * Each event corresponds to a caseId referenced in dummyRepairs.ts.
 *
 * Facility ID mapping (from dummyParkFacilities.ts buildFeatures):
 *   鶴舞公園:    001-005  名城公園:    006-009  東山動植物園: 010-014
 *   白川公園:    015-017  庄内緑地:    018-021  大高緑地:    022-026
 *   荒子川公園:  027-030  戸田川緑地:  031-034  久屋大通:    035-037
 *   徳川園:      038-040  猪高緑地:    041-044  牧野ヶ池:    045-048
 *   小幡緑地:    049-051  笠寺公園:    052-054  志賀公園:    055-057
 *   瑞穂公園:    058-061  熱田神宮:    062-064  千種公園:    065-067
 *
 * Coordinates from ST_PointOnSurface(geometry) — guaranteed inside park polygons.
 */
import type { ConstructionEvent } from '@nagoya/shared';

export const DUMMY_EVENTS: ConstructionEvent[] = [
  // 鶴舞公園 (昭和区) — PF-demo-001~005, center: [136.919915, 35.155046]
  {
    id: 'EVT-demo-001',
    name: '鶴舞公園 複合遊具ボルト交換工事',
    status: 'closed',
    startDate: '2025-02-01T00:00:00Z',
    endDate: '2025-03-10T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.920215, 35.155246] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '昭和区',
    createdBy: 'demo',
    updatedAt: '2025-03-10T00:00:00Z',
  },
  {
    id: 'EVT-demo-002',
    name: '鶴舞公園 複合遊具防錆塗装工事',
    status: 'closed',
    startDate: '2024-07-15T00:00:00Z',
    endDate: '2024-08-22T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.919615, 35.155346] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '昭和区',
    createdBy: 'demo',
    updatedAt: '2024-08-22T00:00:00Z',
  },
  {
    id: 'EVT-demo-003',
    name: '鶴舞公園 すべり台踊り場デッキ交換工事',
    status: 'active',
    startDate: '2025-09-20T00:00:00Z',
    endDate: '2025-10-15T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.920115, 35.154646] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '昭和区',
    createdBy: 'demo',
    updatedAt: '2025-10-05T00:00:00Z',
  },
  {
    id: 'EVT-demo-004',
    name: '鶴舞公園 すべり台手すり補強工事',
    status: 'closed',
    startDate: '2024-12-10T00:00:00Z',
    endDate: '2025-01-15T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.919615, 35.154846] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '昭和区',
    createdBy: 'demo',
    updatedAt: '2025-01-15T00:00:00Z',
  },
  // 名城公園 (北区) — PF-demo-006~009, center: [136.901605, 35.188603]
  {
    id: 'EVT-demo-005',
    name: '名城公園 複合遊具パネル交換工事',
    status: 'closed',
    startDate: '2025-04-01T00:00:00Z',
    endDate: '2025-05-12T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.901905, 35.188803] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '北区',
    createdBy: 'demo',
    updatedAt: '2025-05-12T00:00:00Z',
  },
  {
    id: 'EVT-demo-006',
    name: '名城公園 鉄棒溶接補修工事',
    status: 'closed',
    startDate: '2025-08-20T00:00:00Z',
    endDate: '2025-09-18T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.901305, 35.188403] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '北区',
    createdBy: 'demo',
    updatedAt: '2025-09-18T00:00:00Z',
  },
  // 東山動植物園 (千種区) — PF-demo-010~014, center: [136.981820, 35.156527]
  {
    id: 'EVT-demo-007',
    name: '東山公園 すべり台衝撃吸収材交換工事',
    status: 'closed',
    startDate: '2025-01-10T00:00:00Z',
    endDate: '2025-02-28T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.982120, 35.156727] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '千種区',
    createdBy: 'demo',
    updatedAt: '2025-02-28T00:00:00Z',
  },
  {
    id: 'EVT-demo-008',
    name: '東山公園 ベンチ座面板交換工事',
    status: 'closed',
    startDate: '2025-03-01T00:00:00Z',
    endDate: '2025-04-10T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.981520, 35.156327] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '千種区',
    createdBy: 'demo',
    updatedAt: '2025-04-10T00:00:00Z',
  },
  // 白川公園 (中区) — PF-demo-015~017, center: [136.899989, 35.164484]
  {
    id: 'EVT-demo-009',
    name: '白川公園 インターロッキング補修工事',
    status: 'closed',
    startDate: '2025-07-25T00:00:00Z',
    endDate: '2025-08-20T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.900289, 35.164684] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '中区',
    createdBy: 'demo',
    updatedAt: '2025-08-20T00:00:00Z',
  },
  // 庄内緑地公園 (西区) — PF-demo-018~021, center: [136.882604, 35.211721]
  {
    id: 'EVT-demo-010',
    name: '庄内緑地 複合遊具グリップ交換工事',
    status: 'closed',
    startDate: '2025-03-01T00:00:00Z',
    endDate: '2025-04-05T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.882904, 35.211921] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '西区',
    createdBy: 'demo',
    updatedAt: '2025-04-05T00:00:00Z',
  },
  {
    id: 'EVT-demo-011',
    name: '庄内緑地 健康器具スプリング交換工事',
    status: 'active',
    startDate: '2025-11-01T00:00:00Z',
    endDate: '2025-12-20T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.882304, 35.211521] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '西区',
    createdBy: 'demo',
    updatedAt: '2025-12-01T00:00:00Z',
  },
  // 大高緑地公園 (緑区) — PF-demo-022~026, center: [136.954263, 35.064370]
  {
    id: 'EVT-demo-012',
    name: '大高緑地 すべり台踊り場デッキ交換工事',
    status: 'closed',
    startDate: '2024-12-01T00:00:00Z',
    endDate: '2025-01-20T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.954563, 35.064570] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '緑区',
    createdBy: 'demo',
    updatedAt: '2025-01-20T00:00:00Z',
  },
  {
    id: 'EVT-demo-013',
    name: '大高緑地 ブランコ座面チェーン交換工事',
    status: 'closed',
    startDate: '2025-02-15T00:00:00Z',
    endDate: '2025-03-25T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.953963, 35.064170] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '緑区',
    createdBy: 'demo',
    updatedAt: '2025-03-25T00:00:00Z',
  },
  {
    id: 'EVT-demo-014',
    name: '大高緑地 パーゴラ柱腐食部分交換工事',
    status: 'active',
    startDate: '2025-06-20T00:00:00Z',
    endDate: '2025-08-15T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.954763, 35.063970] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '緑区',
    createdBy: 'demo',
    updatedAt: '2025-07-15T00:00:00Z',
  },
  // 笠寺公園 (南区) — PF-demo-052~054, center: [136.940503, 35.099819]
  {
    id: 'EVT-demo-015',
    name: '笠寺公園 複合遊具パネル交換工事',
    status: 'closed',
    startDate: '2025-08-01T00:00:00Z',
    endDate: '2025-09-15T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.940803, 35.100019] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '南区',
    createdBy: 'demo',
    updatedAt: '2025-09-15T00:00:00Z',
  },
  // 志賀公園 (北区) — PF-demo-055~057, center: [136.904724, 35.202371]
  {
    id: 'EVT-demo-016',
    name: '志賀公園 ジャングルジム防錆塗装工事',
    status: 'pending_review',
    startDate: '2025-10-15T00:00:00Z',
    endDate: '2025-12-10T00:00:00Z',
    restrictionType: 'workzone',
    geometry: { type: 'Point', coordinates: [136.905024, 35.202571] },
    postEndDecision: 'no-change',
    department: '緑政土木局',
    ward: '北区',
    createdBy: 'demo',
    updatedAt: '2025-11-20T00:00:00Z',
  },
];

export function getDummyEvent(id: string): ConstructionEvent | undefined {
  return DUMMY_EVENTS.find((e) => e.id === id);
}

/** Map dummy event IDs to their parent park (greenspace) IDs */
const EVENT_PARK_MAP: Record<string, string> = {
  'EVT-demo-001': 'GS-zxpnkee2', // 鶴舞公園
  'EVT-demo-002': 'GS-zxpnkee2',
  'EVT-demo-003': 'GS-zxpnkee2',
  'EVT-demo-004': 'GS-zxpnkee2',
  'EVT-demo-005': 'GS-nliigh01', // 名城公園
  'EVT-demo-006': 'GS-nliigh01',
  'EVT-demo-007': 'GS-4g77l6x7', // 東山動植物園
  'EVT-demo-008': 'GS-4g77l6x7',
  'EVT-demo-009': 'GS-es1u7z8r', // 白川公園
  'EVT-demo-010': 'GS-9ego0pvp', // 庄内緑地
  'EVT-demo-011': 'GS-9ego0pvp',
  'EVT-demo-012': 'GS-auy42b1p', // 大高緑地
  'EVT-demo-013': 'GS-auy42b1p',
  'EVT-demo-014': 'GS-auy42b1p',
  'EVT-demo-015': 'GS-9exy95g1', // 笠寺公園
  'EVT-demo-016': 'GS-xk4kyf2q', // 志賀公園
};

export function getDummyEventParkId(eventId: string): string | null {
  return EVENT_PARK_MAP[eventId] ?? null;
}
