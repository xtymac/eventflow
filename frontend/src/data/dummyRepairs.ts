/**
 * Dummy repair history data for demo.
 * Each repair is linked to a facility (facilityId) and optionally to a case (caseId).
 * caseId references a construction event for navigation to /cases/:id.
 *
 * Facility ID mapping (from dummyParkFacilities.ts buildFeatures):
 *   鶴舞公園:    001-005  名城公園:    006-009  東山動植物園: 010-014
 *   白川公園:    015-017  庄内緑地:    018-021  大高緑地:    022-026
 *   荒子川公園:  027-030  戸田川緑地:  031-034  久屋大通:    035-037
 *   徳川園:      038-040  猪高緑地:    041-044  牧野ヶ池:    045-048
 *   小幡緑地:    049-051  笠寺公園:    052-054  志賀公園:    055-057
 *   瑞穂公園:    058-061  熱田神宮:    062-064  千種公園:    065-067
 */

export interface DummyRepair {
  id: string;
  facilityId: string;
  date: string;
  type: string;
  description: string;
  status: string;
  caseId?: string; // links to /cases/:id (construction event)
}

export const DUMMY_REPAIRS: DummyRepair[] = [
  // ── 鶴舞公園 (PF-demo-001~005) ──
  { id: 'REP-001', facilityId: 'PF-demo-001', date: '2025-03-10', type: '部品交換', description: '複合遊具の接合ボルト交換', status: '完了', caseId: 'EVT-demo-001' },
  { id: 'REP-002', facilityId: 'PF-demo-001', date: '2024-08-22', type: '塗装', description: '複合遊具の防錆塗装', status: '完了', caseId: 'EVT-demo-002' },
  { id: 'REP-003', facilityId: 'PF-demo-004', date: '2025-10-05', type: '部品交換', description: 'すべり台の踊り場デッキ交換', status: '対応中', caseId: 'EVT-demo-003' },
  { id: 'REP-004', facilityId: 'PF-demo-004', date: '2025-01-15', type: '安全対策', description: 'すべり台の手すり補強', status: '完了', caseId: 'EVT-demo-004' },
  { id: 'REP-005', facilityId: 'PF-demo-002', date: '2025-06-20', type: '塗装', description: 'ベンチ表面の再塗装', status: '完了' },

  // ── 名城公園 (PF-demo-006~009) ──
  { id: 'REP-011', facilityId: 'PF-demo-006', date: '2025-05-12', type: '部品交換', description: '複合遊具の劣化パネル交換', status: '完了', caseId: 'EVT-demo-005' },
  { id: 'REP-012', facilityId: 'PF-demo-009', date: '2025-09-18', type: '溶接補修', description: '鉄棒の接合部溶接補修', status: '完了', caseId: 'EVT-demo-006' },
  { id: 'REP-013', facilityId: 'PF-demo-007', date: '2025-07-03', type: '塗装', description: 'シェルター防錆塗装', status: '完了' },

  // ── 東山動植物園 (PF-demo-010~014) ──
  { id: 'REP-021', facilityId: 'PF-demo-011', date: '2025-02-28', type: '部品交換', description: 'すべり台の着地部衝撃吸収材交換', status: '完了', caseId: 'EVT-demo-007' },
  { id: 'REP-022', facilityId: 'PF-demo-012', date: '2025-04-10', type: '部材交換', description: '腐食した座面板の交換（6基）', status: '完了', caseId: 'EVT-demo-008' },
  { id: 'REP-023', facilityId: 'PF-demo-012', date: '2024-11-15', type: '塗装', description: 'ベンチ脚部の防錆塗装', status: '完了' },

  // ── 白川公園 (PF-demo-015~017) ──
  { id: 'REP-031', facilityId: 'PF-demo-016', date: '2025-08-20', type: '舗装補修', description: 'インターロッキング部分補修（陥没箇所）', status: '完了', caseId: 'EVT-demo-009' },

  // ── 庄内緑地公園 (PF-demo-018~021) ──
  { id: 'REP-041', facilityId: 'PF-demo-018', date: '2025-04-05', type: '部品交換', description: '複合遊具のグリップ交換', status: '完了', caseId: 'EVT-demo-010' },
  { id: 'REP-042', facilityId: 'PF-demo-020', date: '2025-12-01', type: '部品交換', description: '健康器具のスプリング交換', status: '対応中', caseId: 'EVT-demo-011' },

  // ── 大高緑地公園 (PF-demo-022~026) ──
  { id: 'REP-051', facilityId: 'PF-demo-022', date: '2025-01-20', type: '部品交換', description: 'すべり台の踊り場デッキ交換', status: '完了', caseId: 'EVT-demo-012' },
  { id: 'REP-052', facilityId: 'PF-demo-022', date: '2024-06-10', type: '塗装', description: 'すべり台の防錆塗装', status: '完了' },
  { id: 'REP-053', facilityId: 'PF-demo-023', date: '2025-03-25', type: '部品交換', description: 'ブランコ座面チェーン交換', status: '完了', caseId: 'EVT-demo-013' },
  { id: 'REP-054', facilityId: 'PF-demo-025', date: '2025-07-15', type: '木材交換', description: 'パーゴラ柱の腐食部分交換', status: '対応中', caseId: 'EVT-demo-014' },

  // ── 荒子川公園 (PF-demo-027~030) ──
  { id: 'REP-061', facilityId: 'PF-demo-028', date: '2025-06-10', type: '溶接補修', description: '鉄棒の溶接補修', status: '完了' },

  // ── 笠寺公園 (PF-demo-052~054) ──
  { id: 'REP-071', facilityId: 'PF-demo-052', date: '2025-09-15', type: '部品交換', description: '複合遊具の劣化パネル交換', status: '完了', caseId: 'EVT-demo-015' },
  { id: 'REP-072', facilityId: 'PF-demo-052', date: '2025-02-10', type: '安全対策', description: '複合遊具の転落防止柵設置', status: '完了' },

  // ── 志賀公園 (PF-demo-055~057) ──
  { id: 'REP-081', facilityId: 'PF-demo-057', date: '2025-11-20', type: '塗装', description: 'ジャングルジム防錆塗装', status: '対応中', caseId: 'EVT-demo-016' },

  // ── 久屋大通公園 (PF-demo-035~037) ──
  { id: 'REP-091', facilityId: 'PF-demo-035', date: '2025-10-10', type: '部材交換', description: 'ベンチ座面の木材交換（5基）', status: '完了' },
];

/** Get repairs for a specific facility */
export function getDummyRepairsByFacility(facilityId: string): DummyRepair[] {
  return DUMMY_REPAIRS.filter((r) => r.facilityId === facilityId);
}

/** Get the facility ID linked to a given event/case ID */
export function getFacilityIdByEventId(eventId: string): string | null {
  const repair = DUMMY_REPAIRS.find((r) => r.caseId === eventId);
  return repair?.facilityId ?? null;
}
