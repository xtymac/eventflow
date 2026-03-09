/**
 * Dummy case (案件) data matching the Figma design for the Case Management page.
 *
 * Each case links to a park (via parkRef → curatedParks) and a facility (via facilityRef → dummyFacilities).
 * Status values: 'pending' (未確認), 'returned' (差戻), 'confirmed' (確認済)
 * Type values: 'inspection' (点検), 'repair' (補修)
 * Urgency: 'high' (高), 'medium' (中), 'low' (低)
 */

export interface DummyCase {
  id: number;
  status: 'pending' | 'returned' | 'confirmed';
  type: 'inspection' | 'repair';
  parkRef: string;       // curatedParks ID (e.g. 'GS-nliigh01')
  parkName: string;      // display name for convenience
  facilityRef: string;   // dummyFacilities ID (e.g. 'PF-demo-011')
  facilityName: string;  // e.g. 'テーブル'
  facilityId: string;    // e.g. '05-780'
  vendor: string;
  createdDate: string;   // YYYY/MM/DD
  createdAt?: string;    // ISO 8601 timestamp for accurate sorting
  lastStatusChange: string; // YYYY/MM/DD
  urgency: 'high' | 'medium' | 'low';
  repairRef?: string;    // DummyRepair.id for repair-type cases (e.g. 'REP-014')
}

export const CASE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: '未確認', className: 'bg-[#f5f5f5] text-[#404040] border border-[#d4d4d4]' },
  returned:  { label: '差戻',   className: 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]' },
  confirmed: { label: '確認済', className: 'bg-[#D1FAE5] text-[#065F46] border border-[#10B981]' },
};

export const CASE_TYPE_LABELS: Record<string, string> = {
  inspection: '点検',
  repair: '補修',
};

export const CASE_URGENCY_CONFIG: Record<string, { label: string; cls: string }> = {
  high:   { label: '高', cls: 'bg-[#ffe2e2] text-[#dc2626]' },
  medium: { label: '中', cls: 'bg-[#fef3c7] text-[#92400e]' },
  low:    { label: '低', cls: 'bg-[#d1fae5] text-[#065f46]' },
};

/**
 * Calculate urgency from structureRank & wearRank (A/B/C/D).
 *  - D in either rank, or both C → 高 (high)
 *  - C in either rank (but not both) → 中 (medium)
 *  - Both A or B → 低 (low)
 */
const RANK_SCORE: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };

export function calculateUrgency(
  structureRank?: string,
  wearRank?: string,
): 'high' | 'medium' | 'low' | undefined {
  const s = structureRank ? RANK_SCORE[structureRank] : undefined;
  const w = wearRank ? RANK_SCORE[wearRank] : undefined;
  if (s == null && w == null) return undefined;
  const worst = Math.max(s ?? 0, w ?? 0);
  if (worst >= 4) return 'high';
  if (worst >= 3) {
    // Both C → high
    if ((s ?? 0) >= 3 && (w ?? 0) >= 3) return 'high';
    return 'medium';
  }
  return 'low';
}

export const DUMMY_CASES: DummyCase[] = [
  // Row 1: 未確認 23563 点検 名城公園 テーブル, 05-780 (PF-demo-011 is in 名城公園)
  { id: 23563, status: 'pending',   type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-011', facilityName: 'テーブル', facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'high' },
  // Row 2: 未確認 12357 補修 名城公園 テーブル, 05-780
  { id: 12357, status: 'pending',   type: 'repair',     parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-011', facilityName: 'テーブル', facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'low', repairRef: 'REP-014' },
  // Row 3: 未確認 12358 点検 中村公園 テーブル, 05-780
  { id: 12358, status: 'pending',   type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '中村公園',   facilityRef: 'PF-demo-011', facilityName: 'テーブル', facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'low' },
  // Row 4: 差戻 12359 補修 瑞穂公園 ベンチ, 05-780
  { id: 12359, status: 'returned',  type: 'repair',     parkRef: 'GS-9ego0pvp', parkName: '瑞穂公園',   facilityRef: 'PF-demo-012', facilityName: 'ベンチ',   facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'high', repairRef: 'REP-022' },
  // Row 5: 確認済 12360 補修 庄内緑地 ベンチ (使用中)
  { id: 12360, status: 'confirmed', type: 'repair',     parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-012', facilityName: 'ベンチ',   facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'high', repairRef: 'REP-023' },
  // Row 6: 差戻 12361 補修 呼続公園
  { id: 12361, status: 'returned',  type: 'repair',     parkRef: 'GS-auy42b1p', parkName: '呼続公園',   facilityRef: 'PF-demo-012', facilityName: 'ベンチ',   facilityId: '05-760', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'medium', repairRef: 'REP-022' },
  // Row 7: 未確認 12362 点検 千種公園
  { id: 12362, status: 'pending',   type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '千種公園',   facilityRef: 'PF-demo-022', facilityName: 'ブランコ', facilityId: '01-320', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'low' },
  // Row 8: 差戻 12363 補修 志賀公園
  { id: 12363, status: 'returned',  type: 'repair',     parkRef: 'GS-xk4kyf2q', parkName: '志賀公園',   facilityRef: 'PF-demo-013', facilityName: 'パーゴラ', facilityId: '05-710', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'high', repairRef: 'REP-013' },
  // Row 9: 未確認 12364 補修 呼続公園
  { id: 12364, status: 'pending',   type: 'repair',     parkRef: 'GS-auy42b1p', parkName: '呼続公園',   facilityRef: 'PF-demo-052', facilityName: 'すべり台', facilityId: '13-620', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'high', repairRef: 'REP-071' },
  // Row 10: 確認済 12365 補修 天白公園
  { id: 12365, status: 'confirmed', type: 'repair',     parkRef: 'GS-es1u7z8r', parkName: '天白公園',   facilityRef: 'PF-demo-031', facilityName: 'トイレ',   facilityId: '09-410', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'low', repairRef: 'REP-031' },
  // Row 11: 確認済 12366 点検 天白公園
  { id: 12366, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '天白公園',   facilityRef: 'PF-demo-032', facilityName: '公園灯',   facilityId: '09-420', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'high' },
  // Row 12: 差戻 12367 補修 瑞穂公園
  { id: 12367, status: 'returned',  type: 'repair',     parkRef: 'GS-9ego0pvp', parkName: '瑞穂公園',   facilityRef: 'PF-demo-042', facilityName: 'テニスコート', facilityId: '05-520', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'medium', repairRef: 'REP-042' },
  // Row 13: 確認済 12368 点検 名城公園
  { id: 12368, status: 'confirmed', type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-014', facilityName: '水飲み場', facilityId: '05-790', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'medium' },
  // Row 14: 確認済 12369 点検 白鳥公園
  { id: 12369, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白鳥公園',   facilityRef: 'PF-demo-033', facilityName: '園路',     facilityId: '09-430', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'low' },
  // Row 15: 未確認 12370 点検 名城公園
  { id: 12370, status: 'pending',   type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-011', facilityName: 'テーブル', facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'high' },
  // Row 16: 確認済 12371 点検 天白公園
  { id: 12371, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '天白公園',   facilityRef: 'PF-demo-012', facilityName: 'ベンチ',   facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'high' },

  // Additional rows to match counts: 未確認 18, 差戻 3(already have 4, adjust), 確認済 54
  // Add more pending cases
  { id: 12372, status: 'pending',   type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-015', facilityName: '花壇',     facilityId: '05-800', vendor: '△△建設',     createdDate: '2025/07/28', lastStatusChange: '2025/07/28', urgency: 'low' },
  { id: 12373, status: 'pending',   type: 'repair',     parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-002', facilityName: '複合遊具', facilityId: '03-220', vendor: '△△建設',     createdDate: '2025/07/28', lastStatusChange: '2025/07/28', urgency: 'high', repairRef: 'REP-001' },
  { id: 12374, status: 'pending',   type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-003', facilityName: 'ベンチ群', facilityId: '03-230', vendor: '〇〇造園土木', createdDate: '2025/07/27', lastStatusChange: '2025/07/27', urgency: 'medium' },
  { id: 12375, status: 'pending',   type: 'repair',     parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-004', facilityName: 'あずま屋', facilityId: '03-240', vendor: '〇〇造園土木', createdDate: '2025/07/27', lastStatusChange: '2025/07/27', urgency: 'low', repairRef: 'REP-004' },
  { id: 12376, status: 'pending',   type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-051', facilityName: 'トイレ',   facilityId: '13-610', vendor: '△△建設',     createdDate: '2025/07/26', lastStatusChange: '2025/07/26', urgency: 'high' },
  { id: 12377, status: 'pending',   type: 'repair',     parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-053', facilityName: 'あずま屋', facilityId: '13-630', vendor: '〇〇造園土木', createdDate: '2025/07/26', lastStatusChange: '2025/07/26', urgency: 'medium', repairRef: 'REP-053' },
  { id: 12378, status: 'pending',   type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-054', facilityName: '野球場',   facilityId: '13-640', vendor: '△△建設',     createdDate: '2025/07/25', lastStatusChange: '2025/07/25', urgency: 'low' },
  { id: 12379, status: 'pending',   type: 'repair',     parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-041', facilityName: 'トイレ',   facilityId: '05-510', vendor: '〇〇造園土木', createdDate: '2025/07/25', lastStatusChange: '2025/07/25', urgency: 'high', repairRef: 'REP-041' },
  { id: 12380, status: 'pending',   type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-043', facilityName: '防災倉庫', facilityId: '05-530', vendor: '△△建設',     createdDate: '2025/07/24', lastStatusChange: '2025/07/24', urgency: 'low' },
  { id: 12381, status: 'pending',   type: 'repair',     parkRef: 'GS-4g77l6x7', parkName: '東山公園',   facilityRef: 'PF-demo-021', facilityName: 'トイレ',   facilityId: '01-310', vendor: '〇〇造園土木', createdDate: '2025/07/24', lastStatusChange: '2025/07/24', urgency: 'medium' },
  { id: 12382, status: 'pending',   type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山公園',   facilityRef: 'PF-demo-023', facilityName: '掲示板',   facilityId: '01-330', vendor: '△△建設',     createdDate: '2025/07/23', lastStatusChange: '2025/07/23', urgency: 'low' },
  { id: 12383, status: 'pending',   type: 'repair',     parkRef: 'GS-es1u7z8r', parkName: '白川公園',   facilityRef: 'PF-demo-034', facilityName: '記念碑',   facilityId: '09-440', vendor: '〇〇造園土木', createdDate: '2025/07/23', lastStatusChange: '2025/07/23', urgency: 'low' },

  // More confirmed cases to approach 54
  { id: 12384, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-001', facilityName: 'トイレ',   facilityId: '03-210', vendor: '〇〇造園土木', createdDate: '2025/07/22', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12385, status: 'confirmed', type: 'repair',     parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-005', facilityName: '公園灯',   facilityId: '03-250', vendor: '△△建設',     createdDate: '2025/07/22', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12386, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-006', facilityName: '噴水',     facilityId: '03-260', vendor: '〇〇造園土木', createdDate: '2025/07/21', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12387, status: 'confirmed', type: 'repair',     parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-012', facilityName: 'ベンチ',   facilityId: '05-760', vendor: '〇〇造園土木', createdDate: '2025/07/21', lastStatusChange: '2025/07/29', urgency: 'medium' },
  { id: 12388, status: 'confirmed', type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-013', facilityName: 'パーゴラ', facilityId: '05-710', vendor: '△△建設',     createdDate: '2025/07/20', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12389, status: 'confirmed', type: 'repair',     parkRef: 'GS-4g77l6x7', parkName: '東山公園',   facilityRef: 'PF-demo-022', facilityName: 'ブランコ', facilityId: '01-320', vendor: '〇〇造園土木', createdDate: '2025/07/20', lastStatusChange: '2025/07/29', urgency: 'medium' },
  { id: 12390, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山公園',   facilityRef: 'PF-demo-024', facilityName: '自然生態園', facilityId: '01-340', vendor: '△△建設',   createdDate: '2025/07/19', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12391, status: 'confirmed', type: 'repair',     parkRef: 'GS-es1u7z8r', parkName: '白川公園',   facilityRef: 'PF-demo-032', facilityName: '公園灯',   facilityId: '09-420', vendor: '〇〇造園土木', createdDate: '2025/07/19', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12392, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園',   facilityRef: 'PF-demo-033', facilityName: '園路',     facilityId: '09-430', vendor: '△△建設',     createdDate: '2025/07/18', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12393, status: 'confirmed', type: 'repair',     parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-042', facilityName: 'テニスコート', facilityId: '05-520', vendor: '〇〇造園土木', createdDate: '2025/07/18', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12394, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-044', facilityName: '広場',     facilityId: '05-540', vendor: '△△建設',     createdDate: '2025/07/17', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12395, status: 'confirmed', type: 'repair',     parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-052', facilityName: 'すべり台', facilityId: '13-620', vendor: '〇〇造園土木', createdDate: '2025/07/17', lastStatusChange: '2025/07/29', urgency: 'low' },
  { id: 12396, status: 'confirmed', type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-054', facilityName: '野球場',   facilityId: '13-640', vendor: '△△建設',     createdDate: '2025/07/16', lastStatusChange: '2025/07/29', urgency: 'medium' },
  // More confirmed (batching)
  { id: 12397, status: 'confirmed', type: 'repair',     parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-002', facilityName: '複合遊具', facilityId: '03-220', vendor: '〇〇造園土木', createdDate: '2025/07/16', lastStatusChange: '2025/07/28', urgency: 'high' },
  { id: 12398, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-003', facilityName: 'ベンチ群', facilityId: '03-230', vendor: '△△建設',     createdDate: '2025/07/15', lastStatusChange: '2025/07/28', urgency: 'medium' },
  { id: 12399, status: 'confirmed', type: 'repair',     parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-011', facilityName: 'テーブル', facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/07/15', lastStatusChange: '2025/07/28', urgency: 'low' },
  { id: 12400, status: 'confirmed', type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-014', facilityName: '水飲み場', facilityId: '05-790', vendor: '△△建設',     createdDate: '2025/07/14', lastStatusChange: '2025/07/28', urgency: 'low' },
  { id: 12401, status: 'confirmed', type: 'repair',     parkRef: 'GS-4g77l6x7', parkName: '東山公園',   facilityRef: 'PF-demo-021', facilityName: 'トイレ',   facilityId: '01-310', vendor: '〇〇造園土木', createdDate: '2025/07/14', lastStatusChange: '2025/07/28', urgency: 'low' },
  { id: 12402, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山公園',   facilityRef: 'PF-demo-023', facilityName: '掲示板',   facilityId: '01-330', vendor: '△△建設',     createdDate: '2025/07/13', lastStatusChange: '2025/07/28', urgency: 'low' },
  { id: 12403, status: 'confirmed', type: 'repair',     parkRef: 'GS-es1u7z8r', parkName: '白川公園',   facilityRef: 'PF-demo-031', facilityName: 'トイレ',   facilityId: '09-410', vendor: '〇〇造園土木', createdDate: '2025/07/13', lastStatusChange: '2025/07/28', urgency: 'low' },
  { id: 12404, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園',   facilityRef: 'PF-demo-034', facilityName: '記念碑',   facilityId: '09-440', vendor: '△△建設',     createdDate: '2025/07/12', lastStatusChange: '2025/07/28', urgency: 'low' },
  { id: 12405, status: 'confirmed', type: 'repair',     parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-041', facilityName: 'トイレ',   facilityId: '05-510', vendor: '〇〇造園土木', createdDate: '2025/07/12', lastStatusChange: '2025/07/28', urgency: 'medium' },
  { id: 12406, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-043', facilityName: '防災倉庫', facilityId: '05-530', vendor: '△△建設',     createdDate: '2025/07/11', lastStatusChange: '2025/07/28', urgency: 'low' },
  { id: 12407, status: 'confirmed', type: 'repair',     parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-051', facilityName: 'トイレ',   facilityId: '13-610', vendor: '〇〇造園土木', createdDate: '2025/07/11', lastStatusChange: '2025/07/28', urgency: 'high' },
  { id: 12408, status: 'confirmed', type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-053', facilityName: 'あずま屋', facilityId: '13-630', vendor: '△△建設',     createdDate: '2025/07/10', lastStatusChange: '2025/07/28', urgency: 'medium' },
  { id: 12409, status: 'confirmed', type: 'repair',     parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-004', facilityName: 'あずま屋', facilityId: '03-240', vendor: '〇〇造園土木', createdDate: '2025/07/10', lastStatusChange: '2025/07/27', urgency: 'low' },
  { id: 12410, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-005', facilityName: '公園灯',   facilityId: '03-250', vendor: '△△建設',     createdDate: '2025/07/09', lastStatusChange: '2025/07/27', urgency: 'low' },
  { id: 12411, status: 'confirmed', type: 'repair',     parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-015', facilityName: '花壇',     facilityId: '05-800', vendor: '〇〇造園土木', createdDate: '2025/07/09', lastStatusChange: '2025/07/27', urgency: 'low' },
  { id: 12412, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山公園',   facilityRef: 'PF-demo-024', facilityName: '自然生態園', facilityId: '01-340', vendor: '△△建設',   createdDate: '2025/07/08', lastStatusChange: '2025/07/27', urgency: 'low' },
  { id: 12413, status: 'confirmed', type: 'repair',     parkRef: 'GS-es1u7z8r', parkName: '白川公園',   facilityRef: 'PF-demo-033', facilityName: '園路',     facilityId: '09-430', vendor: '〇〇造園土木', createdDate: '2025/07/08', lastStatusChange: '2025/07/27', urgency: 'low' },
  { id: 12414, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-044', facilityName: '広場',     facilityId: '05-540', vendor: '△△建設',     createdDate: '2025/07/07', lastStatusChange: '2025/07/27', urgency: 'low' },
  { id: 12415, status: 'confirmed', type: 'repair',     parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-052', facilityName: 'すべり台', facilityId: '13-620', vendor: '〇〇造園土木', createdDate: '2025/07/07', lastStatusChange: '2025/07/27', urgency: 'low' },
  { id: 12416, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-001', facilityName: 'トイレ',   facilityId: '03-210', vendor: '△△建設',     createdDate: '2025/07/06', lastStatusChange: '2025/07/26', urgency: 'low' },
  { id: 12417, status: 'confirmed', type: 'repair',     parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-012', facilityName: 'ベンチ',   facilityId: '05-760', vendor: '〇〇造園土木', createdDate: '2025/07/06', lastStatusChange: '2025/07/26', urgency: 'medium' },
  { id: 12418, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山公園',   facilityRef: 'PF-demo-022', facilityName: 'ブランコ', facilityId: '01-320', vendor: '△△建設',     createdDate: '2025/07/05', lastStatusChange: '2025/07/26', urgency: 'low' },
  { id: 12419, status: 'confirmed', type: 'repair',     parkRef: 'GS-es1u7z8r', parkName: '白川公園',   facilityRef: 'PF-demo-032', facilityName: '公園灯',   facilityId: '09-420', vendor: '〇〇造園土木', createdDate: '2025/07/05', lastStatusChange: '2025/07/26', urgency: 'low' },
  { id: 12420, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-042', facilityName: 'テニスコート', facilityId: '05-520', vendor: '△△建設', createdDate: '2025/07/04', lastStatusChange: '2025/07/26', urgency: 'low' },
  { id: 12421, status: 'confirmed', type: 'repair',     parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-054', facilityName: '野球場',   facilityId: '13-640', vendor: '〇〇造園土木', createdDate: '2025/07/04', lastStatusChange: '2025/07/26', urgency: 'medium' },
  { id: 12422, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園',   facilityRef: 'PF-demo-006', facilityName: '噴水',     facilityId: '03-260', vendor: '△△建設',     createdDate: '2025/07/03', lastStatusChange: '2025/07/25', urgency: 'low' },
  { id: 12423, status: 'confirmed', type: 'repair',     parkRef: 'GS-nliigh01', parkName: '名城公園',   facilityRef: 'PF-demo-013', facilityName: 'パーゴラ', facilityId: '05-710', vendor: '〇〇造園土木', createdDate: '2025/07/03', lastStatusChange: '2025/07/25', urgency: 'low' },
  { id: 12424, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山公園',   facilityRef: 'PF-demo-021', facilityName: 'トイレ',   facilityId: '01-310', vendor: '△△建設',     createdDate: '2025/07/02', lastStatusChange: '2025/07/25', urgency: 'low' },
  { id: 12425, status: 'confirmed', type: 'repair',     parkRef: 'GS-es1u7z8r', parkName: '白川公園',   facilityRef: 'PF-demo-031', facilityName: 'トイレ',   facilityId: '09-410', vendor: '〇〇造園土木', createdDate: '2025/07/02', lastStatusChange: '2025/07/25', urgency: 'low' },
  { id: 12426, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地',   facilityRef: 'PF-demo-041', facilityName: 'トイレ',   facilityId: '05-510', vendor: '△△建設',     createdDate: '2025/07/01', lastStatusChange: '2025/07/25', urgency: 'low' },
  { id: 12427, status: 'confirmed', type: 'repair',     parkRef: 'GS-auy42b1p', parkName: '大高緑地',   facilityRef: 'PF-demo-051', facilityName: 'トイレ',   facilityId: '13-610', vendor: '〇〇造園土木', createdDate: '2025/07/01', lastStatusChange: '2025/07/25', urgency: 'high' },

  // ── Cases for fixed inspection eventIds ──
  { id: 12430, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-001', facilityName: 'トイレA棟', facilityId: '03-210', vendor: '〇〇造園土木', createdDate: '2024/07/15', lastStatusChange: '2024/08/01', urgency: 'low' },
  { id: 12431, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-002', facilityName: '複合遊具A', facilityId: '03-220', vendor: '△△建設', createdDate: '2025/09/01', lastStatusChange: '2025/09/15', urgency: 'high' },
  { id: 12432, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-021', facilityName: 'トイレA棟', facilityId: '01-310', vendor: '〇〇造園土木', createdDate: '2025/05/01', lastStatusChange: '2025/05/15', urgency: 'low' },
  { id: 12433, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-031', facilityName: 'トイレA棟', facilityId: '09-410', vendor: '〇〇造園土木', createdDate: '2025/08/01', lastStatusChange: '2025/08/15', urgency: 'low' },
  { id: 12434, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地', facilityRef: 'PF-demo-041', facilityName: 'トイレA棟', facilityId: '05-510', vendor: '△△建設', createdDate: '2025/06/01', lastStatusChange: '2025/06/15', urgency: 'medium' },
  { id: 12435, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地', facilityRef: 'PF-demo-042', facilityName: 'テニスコート', facilityId: '05-520', vendor: '〇〇造園土木', createdDate: '2025/06/01', lastStatusChange: '2025/06/15', urgency: 'low' },
  { id: 12436, status: 'confirmed', type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地', facilityRef: 'PF-demo-052', facilityName: 'すべり台', facilityId: '13-620', vendor: '〇〇造園土木', createdDate: '2025/04/01', lastStatusChange: '2025/04/15', urgency: 'low' },
  { id: 12437, status: 'confirmed', type: 'inspection', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-061', facilityName: '公園灯', facilityId: '11-710', vendor: '〇〇造園土木', createdDate: '2025/09/01', lastStatusChange: '2025/09/15', urgency: 'low' },
  { id: 12438, status: 'confirmed', type: 'inspection', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-062', facilityName: 'ベンチ群', facilityId: '11-720', vendor: '〇〇造園土木', createdDate: '2025/09/01', lastStatusChange: '2025/09/15', urgency: 'low' },

  // ── Cases for fixed repair caseIds ──
  { id: 12439, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-001', facilityName: 'トイレA棟', facilityId: '03-210', vendor: '〇〇造園土木', createdDate: '2024/08/22', lastStatusChange: '2024/09/10', urgency: 'low', repairRef: 'REP-002' },
  { id: 12440, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-004', facilityName: 'あずま屋', facilityId: '03-240', vendor: '△△建設', createdDate: '2025/10/05', lastStatusChange: '2025/10/20', urgency: 'medium', repairRef: 'REP-003' },
  { id: 12441, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-002', facilityName: '複合遊具A', facilityId: '03-220', vendor: '△△建設', createdDate: '2025/06/20', lastStatusChange: '2025/07/05', urgency: 'medium', repairRef: 'REP-005' },
  { id: 12442, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-006', facilityName: '噴水', facilityId: '03-260', vendor: '〇〇造園土木', createdDate: '2025/05/12', lastStatusChange: '2025/05/30', urgency: 'low', repairRef: 'REP-011' },
  { id: 12443, status: 'confirmed', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-009', facilityName: '鉄棒', facilityId: '05-740', vendor: '△△建設', createdDate: '2025/09/18', lastStatusChange: '2025/10/01', urgency: 'medium', repairRef: 'REP-012' },
  { id: 12444, status: 'pending', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-011', facilityName: 'ピクニックテーブル', facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/07/29', lastStatusChange: '2025/07/29', urgency: 'low', repairRef: 'REP-015' },
  { id: 12445, status: 'confirmed', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-011', facilityName: 'ピクニックテーブル', facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2025/02/28', lastStatusChange: '2025/03/15', urgency: 'medium', repairRef: 'REP-021' },
  { id: 12446, status: 'confirmed', type: 'repair', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-022', facilityName: 'ブランコ', facilityId: '01-320', vendor: '△△建設', createdDate: '2025/01/20', lastStatusChange: '2025/02/10', urgency: 'medium', repairRef: 'REP-051' },
  { id: 12447, status: 'confirmed', type: 'repair', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-022', facilityName: 'ブランコ', facilityId: '01-320', vendor: '〇〇造園土木', createdDate: '2024/06/10', lastStatusChange: '2024/06/25', urgency: 'low', repairRef: 'REP-052' },
  { id: 12448, status: 'confirmed', type: 'repair', parkRef: 'GS-auy42b1p', parkName: '大高緑地', facilityRef: 'PF-demo-025', facilityName: 'パーゴラ', facilityId: '13-650', vendor: '△△建設', createdDate: '2025/07/15', lastStatusChange: '2025/08/01', urgency: 'medium', repairRef: 'REP-054' },
  { id: 12449, status: 'confirmed', type: 'repair', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-028', facilityName: '鉄棒', facilityId: '07-540', vendor: '△△建設', createdDate: '2025/06/10', lastStatusChange: '2025/06/25', urgency: 'low', repairRef: 'REP-061' },
  { id: 12450, status: 'confirmed', type: 'repair', parkRef: 'GS-auy42b1p', parkName: '大高緑地', facilityRef: 'PF-demo-052', facilityName: 'すべり台', facilityId: '13-620', vendor: '〇〇造園土木', createdDate: '2025/02/10', lastStatusChange: '2025/02/25', urgency: 'low', repairRef: 'REP-072' },
  { id: 12451, status: 'confirmed', type: 'repair', parkRef: 'GS-xk4kyf2q', parkName: '志賀公園', facilityRef: 'PF-demo-057', facilityName: 'ジャングルジム', facilityId: '12-510', vendor: '△△建設', createdDate: '2025/11/20', lastStatusChange: '2025/12/05', urgency: 'low', repairRef: 'REP-081' },
  { id: 12452, status: 'confirmed', type: 'repair', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-035', facilityName: 'ベンチ', facilityId: '11-750', vendor: '〇〇造園土木', createdDate: '2025/10/10', lastStatusChange: '2025/10/25', urgency: 'low', repairRef: 'REP-091' },
  { id: 12453, status: 'confirmed', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-011', facilityName: 'ピクニックテーブル', facilityId: '05-780', vendor: '〇〇造園土木', createdDate: '2024/12/10', lastStatusChange: '2024/12/20', urgency: 'low', repairRef: 'REP-016' },

  // ── Cases for new inspection records (12460-12489) ──
  { id: 12460, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-005', facilityName: '公園灯', facilityId: '03-250', vendor: '△△建設', createdDate: '2025/08/15', lastStatusChange: '2025/08/30', urgency: 'low' },
  { id: 12461, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-006', facilityName: '噴水', facilityId: '03-260', vendor: '〇〇造園土木', createdDate: '2025/06/20', lastStatusChange: '2025/07/05', urgency: 'low' },
  { id: 12462, status: 'confirmed', type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-014', facilityName: '水飲み場', facilityId: '05-790', vendor: '△△建設', createdDate: '2025/07/10', lastStatusChange: '2025/07/25', urgency: 'low' },
  { id: 12463, status: 'confirmed', type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-015', facilityName: '花壇', facilityId: '05-800', vendor: '〇〇造園土木', createdDate: '2025/07/10', lastStatusChange: '2025/07/25', urgency: 'low' },
  { id: 12464, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-023', facilityName: '掲示板', facilityId: '01-330', vendor: '△△建設', createdDate: '2025/05/15', lastStatusChange: '2025/05/30', urgency: 'low' },
  { id: 12465, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-024', facilityName: '自然生態園', facilityId: '01-340', vendor: '〇〇造園土木', createdDate: '2025/05/15', lastStatusChange: '2025/05/30', urgency: 'low' },
  { id: 12466, status: 'pending', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-032', facilityName: '公園灯', facilityId: '09-420', vendor: '△△建設', createdDate: '2025/08/10', lastStatusChange: '2025/08/10', urgency: 'low' },
  { id: 12467, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-033', facilityName: '園路', facilityId: '09-430', vendor: '〇〇造園土木', createdDate: '2025/08/10', lastStatusChange: '2025/08/25', urgency: 'low' },
  { id: 12468, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-034', facilityName: '記念碑', facilityId: '09-440', vendor: '△△建設', createdDate: '2025/08/10', lastStatusChange: '2025/08/25', urgency: 'low' },
  { id: 12469, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地', facilityRef: 'PF-demo-043', facilityName: '防災備蓄倉庫', facilityId: '05-530', vendor: '△△建設', createdDate: '2025/06/15', lastStatusChange: '2025/06/30', urgency: 'low' },
  { id: 12470, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地', facilityRef: 'PF-demo-044', facilityName: '広場', facilityId: '05-540', vendor: '〇〇造園土木', createdDate: '2025/06/15', lastStatusChange: '2025/06/30', urgency: 'low' },
  { id: 12471, status: 'confirmed', type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地', facilityRef: 'PF-demo-053', facilityName: 'あずま屋A', facilityId: '13-630', vendor: '△△建設', createdDate: '2025/04/15', lastStatusChange: '2025/04/30', urgency: 'medium' },
  { id: 12472, status: 'pending', type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地', facilityRef: 'PF-demo-054', facilityName: '野球場', facilityId: '13-640', vendor: '〇〇造園土木', createdDate: '2025/04/15', lastStatusChange: '2025/04/15', urgency: 'medium' },
  { id: 12473, status: 'confirmed', type: 'inspection', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-063', facilityName: '舗装路面', facilityId: '11-730', vendor: '△△建設', createdDate: '2025/09/15', lastStatusChange: '2025/09/30', urgency: 'low' },
  { id: 12474, status: 'confirmed', type: 'inspection', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-064', facilityName: '時計', facilityId: '11-740', vendor: '〇〇造園土木', createdDate: '2025/09/15', lastStatusChange: '2025/09/30', urgency: 'low' },
  { id: 12475, status: 'confirmed', type: 'inspection', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-071', facilityName: 'サッカー場', facilityId: '04-410', vendor: '△△建設', createdDate: '2025/07/15', lastStatusChange: '2025/07/30', urgency: 'low' },
  { id: 12476, status: 'pending', type: 'inspection', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-072', facilityName: '駐車場', facilityId: '04-420', vendor: '〇〇造園土木', createdDate: '2025/07/15', lastStatusChange: '2025/07/15', urgency: 'medium' },
  { id: 12477, status: 'confirmed', type: 'inspection', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-073', facilityName: '柵・フェンス', facilityId: '04-430', vendor: '△△建設', createdDate: '2025/07/15', lastStatusChange: '2025/07/30', urgency: 'medium' },
  { id: 12478, status: 'confirmed', type: 'inspection', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-081', facilityName: '砂場', facilityId: '07-510', vendor: '〇〇造園土木', createdDate: '2025/05/10', lastStatusChange: '2025/05/25', urgency: 'medium' },
  { id: 12479, status: 'pending', type: 'inspection', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-082', facilityName: '橋梁', facilityId: '07-520', vendor: '△△建設', createdDate: '2025/05/10', lastStatusChange: '2025/05/10', urgency: 'high' },
  { id: 12480, status: 'confirmed', type: 'inspection', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-083', facilityName: '池', facilityId: '07-530', vendor: '〇〇造園土木', createdDate: '2025/05/10', lastStatusChange: '2025/05/25', urgency: 'low' },
  { id: 12481, status: 'confirmed', type: 'inspection', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-091', facilityName: '健康遊具', facilityId: '08-610', vendor: '△△建設', createdDate: '2025/06/10', lastStatusChange: '2025/06/25', urgency: 'low' },
  { id: 12482, status: 'pending', type: 'inspection', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-092', facilityName: '野鳥観察所', facilityId: '08-620', vendor: '〇〇造園土木', createdDate: '2025/06/10', lastStatusChange: '2025/06/10', urgency: 'medium' },
  { id: 12483, status: 'confirmed', type: 'inspection', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-093', facilityName: '車止め', facilityId: '08-630', vendor: '△△建設', createdDate: '2025/06/10', lastStatusChange: '2025/06/25', urgency: 'low' },
  { id: 12484, status: 'confirmed', type: 'inspection', parkRef: 'GS-rtljov09', parkName: '千種公園', facilityRef: 'PF-demo-101', facilityName: 'クライミング遊具', facilityId: '02-410', vendor: '〇〇造園土木', createdDate: '2025/08/05', lastStatusChange: '2025/08/20', urgency: 'low' },
  { id: 12485, status: 'confirmed', type: 'inspection', parkRef: 'GS-rtljov09', parkName: '千種公園', facilityRef: 'PF-demo-102', facilityName: '倉庫', facilityId: '02-420', vendor: '△△建設', createdDate: '2025/08/05', lastStatusChange: '2025/08/20', urgency: 'low' },
  { id: 12486, status: 'confirmed', type: 'inspection', parkRef: 'GS-ful7d9lw', parkName: '徳川園', facilityRef: 'PF-demo-111', facilityName: '茶室', facilityId: '06-710', vendor: '〇〇造園土木', createdDate: '2025/09/10', lastStatusChange: '2025/09/25', urgency: 'low' },
  { id: 12487, status: 'confirmed', type: 'inspection', parkRef: 'GS-ful7d9lw', parkName: '徳川園', facilityRef: 'PF-demo-112', facilityName: '池', facilityId: '06-720', vendor: '△△建設', createdDate: '2025/09/10', lastStatusChange: '2025/09/25', urgency: 'low' },
  { id: 12488, status: 'confirmed', type: 'inspection', parkRef: 'GS-7f2voyoy', parkName: '猪高緑地', facilityRef: 'PF-demo-121', facilityName: '消防団詰所', facilityId: '10-510', vendor: '〇〇造園土木', createdDate: '2025/04/10', lastStatusChange: '2025/04/25', urgency: 'low' },
  { id: 12489, status: 'confirmed', type: 'inspection', parkRef: 'GS-7f2voyoy', parkName: '猪高緑地', facilityRef: 'PF-demo-122', facilityName: '園路', facilityId: '10-520', vendor: '△△建設', createdDate: '2025/04/10', lastStatusChange: '2025/04/25', urgency: 'medium' },

  // ── Cases for new repair records (12500-12536) ──
  { id: 12500, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-003', facilityName: 'ベンチ群A', facilityId: '03-230', vendor: '〇〇造園土木', createdDate: '2025/04/20', lastStatusChange: '2025/05/05', urgency: 'medium', repairRef: 'REP-100' },
  { id: 12501, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-005', facilityName: '公園灯', facilityId: '03-250', vendor: '△△建設', createdDate: '2025/09/05', lastStatusChange: '2025/09/20', urgency: 'low', repairRef: 'REP-101' },
  { id: 12502, status: 'confirmed', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-013', facilityName: 'パーゴラ', facilityId: '05-710', vendor: '△△建設', createdDate: '2025/04/10', lastStatusChange: '2025/04/25', urgency: 'low', repairRef: 'REP-102' },
  { id: 12503, status: 'pending', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-014', facilityName: '水飲み場', facilityId: '05-790', vendor: '〇〇造園土木', createdDate: '2025/08/01', lastStatusChange: '2025/08/01', urgency: 'low', repairRef: 'REP-103' },
  { id: 12504, status: 'confirmed', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-015', facilityName: '花壇', facilityId: '05-800', vendor: '〇〇造園土木', createdDate: '2025/08/01', lastStatusChange: '2025/08/15', urgency: 'low', repairRef: 'REP-104' },
  { id: 12505, status: 'confirmed', type: 'repair', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-021', facilityName: 'トイレA棟', facilityId: '01-310', vendor: '〇〇造園土木', createdDate: '2025/06/01', lastStatusChange: '2025/06/15', urgency: 'low', repairRef: 'REP-105' },
  { id: 12506, status: 'confirmed', type: 'repair', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-024', facilityName: '自然生態園', facilityId: '01-340', vendor: '△△建設', createdDate: '2025/06/01', lastStatusChange: '2025/06/15', urgency: 'low', repairRef: 'REP-106' },
  { id: 12507, status: 'confirmed', type: 'repair', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-031', facilityName: 'トイレA棟', facilityId: '09-410', vendor: '〇〇造園土木', createdDate: '2025/09/01', lastStatusChange: '2025/09/15', urgency: 'low', repairRef: 'REP-107' },
  { id: 12508, status: 'pending', type: 'repair', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-032', facilityName: '公園灯', facilityId: '09-420', vendor: '△△建設', createdDate: '2025/09/01', lastStatusChange: '2025/09/01', urgency: 'low', repairRef: 'REP-108' },
  { id: 12509, status: 'confirmed', type: 'repair', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-033', facilityName: '園路', facilityId: '09-430', vendor: '〇〇造園土木', createdDate: '2025/09/01', lastStatusChange: '2025/09/15', urgency: 'low', repairRef: 'REP-109' },
  { id: 12510, status: 'confirmed', type: 'repair', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-034', facilityName: '記念碑', facilityId: '09-440', vendor: '△△建設', createdDate: '2025/09/01', lastStatusChange: '2025/09/15', urgency: 'low', repairRef: 'REP-110' },
  { id: 12511, status: 'confirmed', type: 'repair', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地', facilityRef: 'PF-demo-041', facilityName: 'トイレA棟', facilityId: '05-510', vendor: '〇〇造園土木', createdDate: '2025/07/01', lastStatusChange: '2025/07/15', urgency: 'medium', repairRef: 'REP-111' },
  { id: 12512, status: 'confirmed', type: 'repair', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地', facilityRef: 'PF-demo-042', facilityName: 'テニスコート', facilityId: '05-520', vendor: '△△建設', createdDate: '2025/07/01', lastStatusChange: '2025/07/15', urgency: 'low', repairRef: 'REP-112' },
  { id: 12513, status: 'confirmed', type: 'repair', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地', facilityRef: 'PF-demo-043', facilityName: '防災備蓄倉庫', facilityId: '05-530', vendor: '〇〇造園土木', createdDate: '2025/07/01', lastStatusChange: '2025/07/15', urgency: 'low', repairRef: 'REP-113' },
  { id: 12514, status: 'confirmed', type: 'repair', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地', facilityRef: 'PF-demo-044', facilityName: '広場', facilityId: '05-540', vendor: '△△建設', createdDate: '2025/07/01', lastStatusChange: '2025/07/15', urgency: 'low', repairRef: 'REP-114' },
  { id: 12515, status: 'confirmed', type: 'repair', parkRef: 'GS-auy42b1p', parkName: '大高緑地', facilityRef: 'PF-demo-051', facilityName: 'トイレA棟', facilityId: '13-610', vendor: '〇〇造園土木', createdDate: '2025/05/01', lastStatusChange: '2025/05/15', urgency: 'high', repairRef: 'REP-115' },
  { id: 12516, status: 'pending', type: 'repair', parkRef: 'GS-auy42b1p', parkName: '大高緑地', facilityRef: 'PF-demo-053', facilityName: 'あずま屋A', facilityId: '13-630', vendor: '△△建設', createdDate: '2025/05/01', lastStatusChange: '2025/05/01', urgency: 'medium', repairRef: 'REP-116' },
  { id: 12517, status: 'confirmed', type: 'repair', parkRef: 'GS-auy42b1p', parkName: '大高緑地', facilityRef: 'PF-demo-054', facilityName: '野球場', facilityId: '13-640', vendor: '〇〇造園土木', createdDate: '2025/05/01', lastStatusChange: '2025/05/15', urgency: 'medium', repairRef: 'REP-117' },
  { id: 12518, status: 'confirmed', type: 'repair', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-061', facilityName: '公園灯', facilityId: '11-710', vendor: '△△建設', createdDate: '2025/10/01', lastStatusChange: '2025/10/15', urgency: 'low', repairRef: 'REP-118' },
  { id: 12519, status: 'confirmed', type: 'repair', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-062', facilityName: 'ベンチ群', facilityId: '11-720', vendor: '〇〇造園土木', createdDate: '2025/10/01', lastStatusChange: '2025/10/15', urgency: 'low', repairRef: 'REP-119' },
  { id: 12520, status: 'confirmed', type: 'repair', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-063', facilityName: '舗装路面', facilityId: '11-730', vendor: '△△建設', createdDate: '2025/10/01', lastStatusChange: '2025/10/15', urgency: 'low', repairRef: 'REP-120' },
  { id: 12521, status: 'confirmed', type: 'repair', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-064', facilityName: '時計', facilityId: '11-740', vendor: '〇〇造園土木', createdDate: '2025/10/01', lastStatusChange: '2025/10/15', urgency: 'low', repairRef: 'REP-121' },
  { id: 12522, status: 'confirmed', type: 'repair', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-071', facilityName: 'サッカー場', facilityId: '04-410', vendor: '△△建設', createdDate: '2025/08/01', lastStatusChange: '2025/08/15', urgency: 'low', repairRef: 'REP-122' },
  { id: 12523, status: 'confirmed', type: 'repair', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-072', facilityName: '駐車場', facilityId: '04-420', vendor: '〇〇造園土木', createdDate: '2025/08/01', lastStatusChange: '2025/08/15', urgency: 'medium', repairRef: 'REP-123' },
  { id: 12524, status: 'returned', type: 'repair', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-073', facilityName: '柵・フェンス', facilityId: '04-430', vendor: '△△建設', createdDate: '2025/08/01', lastStatusChange: '2025/08/10', urgency: 'medium', repairRef: 'REP-124' },
  { id: 12525, status: 'confirmed', type: 'repair', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-081', facilityName: '砂場', facilityId: '07-510', vendor: '〇〇造園土木', createdDate: '2025/06/01', lastStatusChange: '2025/06/15', urgency: 'medium', repairRef: 'REP-125' },
  { id: 12526, status: 'pending', type: 'repair', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-082', facilityName: '橋梁', facilityId: '07-520', vendor: '△△建設', createdDate: '2025/06/01', lastStatusChange: '2025/06/01', urgency: 'high', repairRef: 'REP-126' },
  { id: 12527, status: 'confirmed', type: 'repair', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-083', facilityName: '池', facilityId: '07-530', vendor: '〇〇造園土木', createdDate: '2025/06/01', lastStatusChange: '2025/06/15', urgency: 'low', repairRef: 'REP-127' },
  { id: 12528, status: 'confirmed', type: 'repair', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-091', facilityName: '健康遊具', facilityId: '08-610', vendor: '△△建設', createdDate: '2025/07/10', lastStatusChange: '2025/07/25', urgency: 'low', repairRef: 'REP-128' },
  { id: 12529, status: 'confirmed', type: 'repair', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-092', facilityName: '野鳥観察所', facilityId: '08-620', vendor: '〇〇造園土木', createdDate: '2025/07/10', lastStatusChange: '2025/07/25', urgency: 'medium', repairRef: 'REP-129' },
  { id: 12530, status: 'confirmed', type: 'repair', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-093', facilityName: '車止め', facilityId: '08-630', vendor: '△△建設', createdDate: '2025/07/10', lastStatusChange: '2025/07/25', urgency: 'low', repairRef: 'REP-130' },
  { id: 12531, status: 'confirmed', type: 'repair', parkRef: 'GS-rtljov09', parkName: '千種公園', facilityRef: 'PF-demo-101', facilityName: 'クライミング遊具', facilityId: '02-410', vendor: '〇〇造園土木', createdDate: '2025/09/01', lastStatusChange: '2025/09/15', urgency: 'low', repairRef: 'REP-131' },
  { id: 12532, status: 'confirmed', type: 'repair', parkRef: 'GS-rtljov09', parkName: '千種公園', facilityRef: 'PF-demo-102', facilityName: '倉庫', facilityId: '02-420', vendor: '△△建設', createdDate: '2025/09/01', lastStatusChange: '2025/09/15', urgency: 'low', repairRef: 'REP-132' },
  { id: 12533, status: 'confirmed', type: 'repair', parkRef: 'GS-ful7d9lw', parkName: '徳川園', facilityRef: 'PF-demo-111', facilityName: '茶室', facilityId: '06-710', vendor: '〇〇造園土木', createdDate: '2025/10/01', lastStatusChange: '2025/10/15', urgency: 'low', repairRef: 'REP-133' },
  { id: 12534, status: 'confirmed', type: 'repair', parkRef: 'GS-ful7d9lw', parkName: '徳川園', facilityRef: 'PF-demo-112', facilityName: '池', facilityId: '06-720', vendor: '△△建設', createdDate: '2025/10/01', lastStatusChange: '2025/10/15', urgency: 'low', repairRef: 'REP-134' },
  { id: 12535, status: 'confirmed', type: 'repair', parkRef: 'GS-7f2voyoy', parkName: '猪高緑地', facilityRef: 'PF-demo-121', facilityName: '消防団詰所', facilityId: '10-510', vendor: '〇〇造園土木', createdDate: '2025/05/01', lastStatusChange: '2025/05/15', urgency: 'low', repairRef: 'REP-135' },
  { id: 12536, status: 'confirmed', type: 'repair', parkRef: 'GS-7f2voyoy', parkName: '猪高緑地', facilityRef: 'PF-demo-122', facilityName: '園路', facilityId: '10-520', vendor: '△△建設', createdDate: '2025/05/01', lastStatusChange: '2025/05/15', urgency: 'medium', repairRef: 'REP-136' },

  // ── Cases for additional inspections (12550-12594) ──
  // 鶴舞公園
  { id: 12550, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-002', facilityName: '複合遊具A', facilityId: '03-220', vendor: '〇〇造園土木', createdDate: '2024/11/10', lastStatusChange: '2024/11/25', urgency: 'medium' },
  { id: 12551, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-003', facilityName: 'ベンチ群A', facilityId: '03-230', vendor: '△△建設', createdDate: '2024/10/20', lastStatusChange: '2024/11/05', urgency: 'low' },
  { id: 12552, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-004', facilityName: 'あずま屋', facilityId: '03-240', vendor: '〇〇造園土木', createdDate: '2025/03/10', lastStatusChange: '2025/03/25', urgency: 'low' },
  { id: 12553, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-004', facilityName: 'あずま屋', facilityId: '03-240', vendor: '△△建設', createdDate: '2024/09/15', lastStatusChange: '2024/09/30', urgency: 'low' },
  { id: 12554, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-005', facilityName: '公園灯', facilityId: '03-250', vendor: '〇〇造園土木', createdDate: '2024/12/05', lastStatusChange: '2024/12/20', urgency: 'low' },
  { id: 12555, status: 'confirmed', type: 'inspection', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-006', facilityName: '噴水', facilityId: '03-260', vendor: '△△建設', createdDate: '2024/11/20', lastStatusChange: '2024/12/05', urgency: 'low' },
  // 名城公園
  { id: 12556, status: 'confirmed', type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-012', facilityName: 'ベンチ', facilityId: '05-760', vendor: '〇〇造園土木', createdDate: '2024/09/10', lastStatusChange: '2024/09/25', urgency: 'high' },
  { id: 12557, status: 'confirmed', type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-013', facilityName: 'パーゴラ', facilityId: '05-710', vendor: '△△建設', createdDate: '2024/09/10', lastStatusChange: '2024/09/25', urgency: 'medium' },
  { id: 12558, status: 'confirmed', type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-014', facilityName: '水飲み場', facilityId: '05-790', vendor: '〇〇造園土木', createdDate: '2024/12/01', lastStatusChange: '2024/12/15', urgency: 'low' },
  { id: 12559, status: 'confirmed', type: 'inspection', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-015', facilityName: '花壇', facilityId: '05-800', vendor: '△△建設', createdDate: '2024/12/01', lastStatusChange: '2024/12/15', urgency: 'low' },
  // 東山動植物園
  { id: 12560, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-021', facilityName: 'トイレA棟', facilityId: '01-310', vendor: '〇〇造園土木', createdDate: '2024/11/01', lastStatusChange: '2024/11/15', urgency: 'low' },
  { id: 12561, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-022', facilityName: 'ブランコ', facilityId: '01-320', vendor: '△△建設', createdDate: '2024/11/01', lastStatusChange: '2024/11/15', urgency: 'low' },
  { id: 12562, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-023', facilityName: '掲示板', facilityId: '01-330', vendor: '〇〇造園土木', createdDate: '2024/11/15', lastStatusChange: '2024/11/30', urgency: 'low' },
  { id: 12563, status: 'confirmed', type: 'inspection', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-024', facilityName: '自然生態園', facilityId: '01-340', vendor: '△△建設', createdDate: '2024/11/15', lastStatusChange: '2024/11/30', urgency: 'low' },
  // 白川公園
  { id: 12564, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-031', facilityName: 'トイレA棟', facilityId: '09-410', vendor: '〇〇造園土木', createdDate: '2025/02/01', lastStatusChange: '2025/02/15', urgency: 'low' },
  { id: 12565, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-032', facilityName: '公園灯', facilityId: '09-420', vendor: '△△建設', createdDate: '2025/02/01', lastStatusChange: '2025/02/15', urgency: 'low' },
  { id: 12566, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-033', facilityName: '園路', facilityId: '09-430', vendor: '〇〇造園土木', createdDate: '2025/02/01', lastStatusChange: '2025/02/15', urgency: 'low' },
  { id: 12567, status: 'confirmed', type: 'inspection', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-034', facilityName: '記念碑', facilityId: '09-440', vendor: '△△建設', createdDate: '2025/02/01', lastStatusChange: '2025/02/15', urgency: 'low' },
  // 庄内緑地公園
  { id: 12568, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地公園', facilityRef: 'PF-demo-041', facilityName: 'トイレA棟', facilityId: '05-510', vendor: '〇〇造園土木', createdDate: '2024/12/01', lastStatusChange: '2024/12/15', urgency: 'low' },
  { id: 12569, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地公園', facilityRef: 'PF-demo-042', facilityName: 'テニスコート', facilityId: '05-520', vendor: '△△建設', createdDate: '2024/12/01', lastStatusChange: '2024/12/15', urgency: 'low' },
  { id: 12570, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地公園', facilityRef: 'PF-demo-043', facilityName: '防災備蓄倉庫', facilityId: '05-530', vendor: '〇〇造園土木', createdDate: '2024/12/15', lastStatusChange: '2024/12/30', urgency: 'low' },
  { id: 12571, status: 'confirmed', type: 'inspection', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地公園', facilityRef: 'PF-demo-044', facilityName: '広場', facilityId: '05-540', vendor: '△△建設', createdDate: '2024/12/15', lastStatusChange: '2024/12/30', urgency: 'low' },
  // 大高緑地公園
  { id: 12572, status: 'confirmed', type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地公園', facilityRef: 'PF-demo-051', facilityName: 'トイレA棟', facilityId: '13-610', vendor: '〇〇造園土木', createdDate: '2024/10/01', lastStatusChange: '2024/10/15', urgency: 'high' },
  { id: 12573, status: 'confirmed', type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地公園', facilityRef: 'PF-demo-052', facilityName: 'すべり台', facilityId: '13-620', vendor: '△△建設', createdDate: '2024/10/01', lastStatusChange: '2024/10/15', urgency: 'low' },
  { id: 12574, status: 'confirmed', type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地公園', facilityRef: 'PF-demo-053', facilityName: 'あずま屋A', facilityId: '13-630', vendor: '〇〇造園土木', createdDate: '2024/10/15', lastStatusChange: '2024/10/30', urgency: 'low' },
  { id: 12575, status: 'confirmed', type: 'inspection', parkRef: 'GS-auy42b1p', parkName: '大高緑地公園', facilityRef: 'PF-demo-054', facilityName: '野球場', facilityId: '13-640', vendor: '△△建設', createdDate: '2024/10/15', lastStatusChange: '2024/10/30', urgency: 'medium' },
  // 久屋大通公園
  { id: 12576, status: 'confirmed', type: 'inspection', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-061', facilityName: '公園灯', facilityId: '11-710', vendor: '〇〇造園土木', createdDate: '2025/03/01', lastStatusChange: '2025/03/15', urgency: 'low' },
  { id: 12577, status: 'confirmed', type: 'inspection', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-062', facilityName: 'ベンチ群', facilityId: '11-720', vendor: '△△建設', createdDate: '2025/03/01', lastStatusChange: '2025/03/15', urgency: 'low' },
  { id: 12578, status: 'confirmed', type: 'inspection', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-063', facilityName: '舗装路面', facilityId: '11-730', vendor: '〇〇造園土木', createdDate: '2025/03/15', lastStatusChange: '2025/03/30', urgency: 'low' },
  { id: 12579, status: 'confirmed', type: 'inspection', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-064', facilityName: '時計', facilityId: '11-740', vendor: '△△建設', createdDate: '2025/03/15', lastStatusChange: '2025/03/30', urgency: 'low' },
  // 瑞穂公園
  { id: 12580, status: 'confirmed', type: 'inspection', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-071', facilityName: 'サッカー場', facilityId: '04-410', vendor: '〇〇造園土木', createdDate: '2025/01/15', lastStatusChange: '2025/01/30', urgency: 'low' },
  { id: 12581, status: 'confirmed', type: 'inspection', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-072', facilityName: '駐車場', facilityId: '04-420', vendor: '△△建設', createdDate: '2025/01/15', lastStatusChange: '2025/01/30', urgency: 'low' },
  { id: 12582, status: 'confirmed', type: 'inspection', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-073', facilityName: '柵・フェンス', facilityId: '04-430', vendor: '〇〇造園土木', createdDate: '2025/01/15', lastStatusChange: '2025/01/30', urgency: 'medium' },
  // 荒子川公園
  { id: 12583, status: 'confirmed', type: 'inspection', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-081', facilityName: '砂場', facilityId: '07-510', vendor: '〇〇造園土木', createdDate: '2024/11/10', lastStatusChange: '2024/11/25', urgency: 'low' },
  { id: 12584, status: 'confirmed', type: 'inspection', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-082', facilityName: '橋梁', facilityId: '07-520', vendor: '△△建設', createdDate: '2024/11/10', lastStatusChange: '2024/11/25', urgency: 'high' },
  { id: 12585, status: 'confirmed', type: 'inspection', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-083', facilityName: '池', facilityId: '07-530', vendor: '〇〇造園土木', createdDate: '2024/11/10', lastStatusChange: '2024/11/25', urgency: 'low' },
  // 戸田川緑地
  { id: 12586, status: 'confirmed', type: 'inspection', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-091', facilityName: '健康遊具', facilityId: '08-610', vendor: '〇〇造園土木', createdDate: '2024/12/10', lastStatusChange: '2024/12/25', urgency: 'low' },
  { id: 12587, status: 'confirmed', type: 'inspection', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-092', facilityName: '野鳥観察所', facilityId: '08-620', vendor: '△△建設', createdDate: '2024/12/10', lastStatusChange: '2024/12/25', urgency: 'low' },
  { id: 12588, status: 'confirmed', type: 'inspection', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-093', facilityName: '車止め', facilityId: '08-630', vendor: '〇〇造園土木', createdDate: '2024/12/10', lastStatusChange: '2024/12/25', urgency: 'low' },
  // 千種公園
  { id: 12589, status: 'confirmed', type: 'inspection', parkRef: 'GS-rtljov09', parkName: '千種公園', facilityRef: 'PF-demo-101', facilityName: 'クライミング遊具', facilityId: '02-410', vendor: '〇〇造園土木', createdDate: '2025/02/05', lastStatusChange: '2025/02/20', urgency: 'low' },
  { id: 12590, status: 'confirmed', type: 'inspection', parkRef: 'GS-rtljov09', parkName: '千種公園', facilityRef: 'PF-demo-102', facilityName: '倉庫', facilityId: '02-420', vendor: '△△建設', createdDate: '2025/02/05', lastStatusChange: '2025/02/20', urgency: 'low' },
  // 徳川園
  { id: 12591, status: 'confirmed', type: 'inspection', parkRef: 'GS-ful7d9lw', parkName: '徳川園', facilityRef: 'PF-demo-111', facilityName: '茶室', facilityId: '06-710', vendor: '〇〇造園土木', createdDate: '2025/03/10', lastStatusChange: '2025/03/25', urgency: 'low' },
  { id: 12592, status: 'confirmed', type: 'inspection', parkRef: 'GS-ful7d9lw', parkName: '徳川園', facilityRef: 'PF-demo-112', facilityName: '池', facilityId: '06-720', vendor: '△△建設', createdDate: '2025/03/10', lastStatusChange: '2025/03/25', urgency: 'low' },
  // 猪高緑地
  { id: 12593, status: 'confirmed', type: 'inspection', parkRef: 'GS-7f2voyoy', parkName: '猪高緑地', facilityRef: 'PF-demo-121', facilityName: '消防団詰所', facilityId: '10-510', vendor: '〇〇造園土木', createdDate: '2024/10/10', lastStatusChange: '2024/10/25', urgency: 'low' },
  { id: 12594, status: 'confirmed', type: 'inspection', parkRef: 'GS-7f2voyoy', parkName: '猪高緑地', facilityRef: 'PF-demo-122', facilityName: '園路', facilityId: '10-520', vendor: '△△建設', createdDate: '2024/10/10', lastStatusChange: '2024/10/25', urgency: 'low' },

  // ── Cases for additional repairs (12600-12639) ──
  // 鶴舞公園
  { id: 12600, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-002', facilityName: '複合遊具A', facilityId: '03-220', vendor: '〇〇造園土木', createdDate: '2024/09/15', lastStatusChange: '2024/09/30', urgency: 'medium', repairRef: 'REP-200' },
  { id: 12601, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-003', facilityName: 'ベンチ群A', facilityId: '03-230', vendor: '△△建設', createdDate: '2024/08/20', lastStatusChange: '2024/09/05', urgency: 'low', repairRef: 'REP-201' },
  { id: 12602, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-005', facilityName: '公園灯', facilityId: '03-250', vendor: '〇〇造園土木', createdDate: '2024/10/10', lastStatusChange: '2024/10/25', urgency: 'low', repairRef: 'REP-202' },
  { id: 12603, status: 'confirmed', type: 'repair', parkRef: 'GS-zxpnkee2', parkName: '鶴舞公園', facilityRef: 'PF-demo-006', facilityName: '噴水', facilityId: '03-260', vendor: '△△建設', createdDate: '2024/11/05', lastStatusChange: '2024/11/20', urgency: 'low', repairRef: 'REP-203' },
  // 名城公園
  { id: 12604, status: 'confirmed', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-013', facilityName: 'パーゴラ', facilityId: '05-710', vendor: '〇〇造園土木', createdDate: '2024/08/15', lastStatusChange: '2024/08/30', urgency: 'medium', repairRef: 'REP-204' },
  { id: 12605, status: 'confirmed', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-014', facilityName: '水飲み場', facilityId: '05-790', vendor: '△△建設', createdDate: '2025/01/20', lastStatusChange: '2025/02/05', urgency: 'low', repairRef: 'REP-205' },
  { id: 12606, status: 'confirmed', type: 'repair', parkRef: 'GS-nliigh01', parkName: '名城公園', facilityRef: 'PF-demo-015', facilityName: '花壇', facilityId: '05-800', vendor: '〇〇造園土木', createdDate: '2025/01/20', lastStatusChange: '2025/02/05', urgency: 'low', repairRef: 'REP-206' },
  // 東山動植物園
  { id: 12607, status: 'confirmed', type: 'repair', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-021', facilityName: 'トイレA棟', facilityId: '01-310', vendor: '△△建設', createdDate: '2024/11/15', lastStatusChange: '2024/11/30', urgency: 'low', repairRef: 'REP-207' },
  { id: 12608, status: 'confirmed', type: 'repair', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-023', facilityName: '掲示板', facilityId: '01-330', vendor: '〇〇造園土木', createdDate: '2024/12/01', lastStatusChange: '2024/12/15', urgency: 'low', repairRef: 'REP-208' },
  { id: 12609, status: 'confirmed', type: 'repair', parkRef: 'GS-4g77l6x7', parkName: '東山動植物園', facilityRef: 'PF-demo-024', facilityName: '自然生態園', facilityId: '01-340', vendor: '△△建設', createdDate: '2024/12/01', lastStatusChange: '2024/12/15', urgency: 'low', repairRef: 'REP-209' },
  // 白川公園
  { id: 12610, status: 'confirmed', type: 'repair', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-031', facilityName: 'トイレA棟', facilityId: '09-410', vendor: '〇〇造園土木', createdDate: '2025/03/01', lastStatusChange: '2025/03/15', urgency: 'low', repairRef: 'REP-210' },
  { id: 12611, status: 'confirmed', type: 'repair', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-032', facilityName: '公園灯', facilityId: '09-420', vendor: '△△建設', createdDate: '2025/03/01', lastStatusChange: '2025/03/15', urgency: 'low', repairRef: 'REP-211' },
  { id: 12612, status: 'confirmed', type: 'repair', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-033', facilityName: '園路', facilityId: '09-430', vendor: '〇〇造園土木', createdDate: '2025/03/01', lastStatusChange: '2025/03/15', urgency: 'low', repairRef: 'REP-212' },
  { id: 12613, status: 'confirmed', type: 'repair', parkRef: 'GS-es1u7z8r', parkName: '白川公園', facilityRef: 'PF-demo-034', facilityName: '記念碑', facilityId: '09-440', vendor: '△△建設', createdDate: '2025/03/01', lastStatusChange: '2025/03/15', urgency: 'low', repairRef: 'REP-213' },
  // 庄内緑地公園
  { id: 12614, status: 'confirmed', type: 'repair', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地公園', facilityRef: 'PF-demo-041', facilityName: 'トイレA棟', facilityId: '05-510', vendor: '〇〇造園土木', createdDate: '2025/01/01', lastStatusChange: '2025/01/15', urgency: 'medium', repairRef: 'REP-214' },
  { id: 12615, status: 'confirmed', type: 'repair', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地公園', facilityRef: 'PF-demo-042', facilityName: 'テニスコート', facilityId: '05-520', vendor: '△△建設', createdDate: '2025/01/01', lastStatusChange: '2025/01/15', urgency: 'low', repairRef: 'REP-215' },
  { id: 12616, status: 'confirmed', type: 'repair', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地公園', facilityRef: 'PF-demo-043', facilityName: '防災備蓄倉庫', facilityId: '05-530', vendor: '〇〇造園土木', createdDate: '2025/01/01', lastStatusChange: '2025/01/15', urgency: 'low', repairRef: 'REP-216' },
  { id: 12617, status: 'confirmed', type: 'repair', parkRef: 'GS-9ego0pvp', parkName: '庄内緑地公園', facilityRef: 'PF-demo-044', facilityName: '広場', facilityId: '05-540', vendor: '△△建設', createdDate: '2025/01/01', lastStatusChange: '2025/01/15', urgency: 'low', repairRef: 'REP-217' },
  // 大高緑地公園
  { id: 12618, status: 'confirmed', type: 'repair', parkRef: 'GS-auy42b1p', parkName: '大高緑地公園', facilityRef: 'PF-demo-051', facilityName: 'トイレA棟', facilityId: '13-610', vendor: '〇〇造園土木', createdDate: '2024/10/15', lastStatusChange: '2024/10/30', urgency: 'high', repairRef: 'REP-218' },
  { id: 12619, status: 'confirmed', type: 'repair', parkRef: 'GS-auy42b1p', parkName: '大高緑地公園', facilityRef: 'PF-demo-053', facilityName: 'あずま屋A', facilityId: '13-630', vendor: '△△建設', createdDate: '2024/10/15', lastStatusChange: '2024/10/30', urgency: 'medium', repairRef: 'REP-219' },
  { id: 12620, status: 'confirmed', type: 'repair', parkRef: 'GS-auy42b1p', parkName: '大高緑地公園', facilityRef: 'PF-demo-054', facilityName: '野球場', facilityId: '13-640', vendor: '〇〇造園土木', createdDate: '2024/10/15', lastStatusChange: '2024/10/30', urgency: 'medium', repairRef: 'REP-220' },
  // 久屋大通公園
  { id: 12621, status: 'confirmed', type: 'repair', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-061', facilityName: '公園灯', facilityId: '11-710', vendor: '△△建設', createdDate: '2025/04/01', lastStatusChange: '2025/04/15', urgency: 'low', repairRef: 'REP-221' },
  { id: 12622, status: 'confirmed', type: 'repair', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-062', facilityName: 'ベンチ群', facilityId: '11-720', vendor: '〇〇造園土木', createdDate: '2025/04/01', lastStatusChange: '2025/04/15', urgency: 'low', repairRef: 'REP-222' },
  { id: 12623, status: 'confirmed', type: 'repair', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-063', facilityName: '舗装路面', facilityId: '11-730', vendor: '△△建設', createdDate: '2025/04/01', lastStatusChange: '2025/04/15', urgency: 'low', repairRef: 'REP-223' },
  { id: 12624, status: 'confirmed', type: 'repair', parkRef: 'GS-byrogagk', parkName: '久屋大通公園', facilityRef: 'PF-demo-064', facilityName: '時計', facilityId: '11-740', vendor: '〇〇造園土木', createdDate: '2025/04/01', lastStatusChange: '2025/04/15', urgency: 'low', repairRef: 'REP-224' },
  // 瑞穂公園
  { id: 12625, status: 'confirmed', type: 'repair', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-071', facilityName: 'サッカー場', facilityId: '04-410', vendor: '△△建設', createdDate: '2025/02/01', lastStatusChange: '2025/02/15', urgency: 'low', repairRef: 'REP-225' },
  { id: 12626, status: 'confirmed', type: 'repair', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-072', facilityName: '駐車場', facilityId: '04-420', vendor: '〇〇造園土木', createdDate: '2025/02/01', lastStatusChange: '2025/02/15', urgency: 'medium', repairRef: 'REP-226' },
  { id: 12627, status: 'confirmed', type: 'repair', parkRef: 'GS-cfam78i3', parkName: '瑞穂公園', facilityRef: 'PF-demo-073', facilityName: '柵・フェンス', facilityId: '04-430', vendor: '△△建設', createdDate: '2025/02/01', lastStatusChange: '2025/02/15', urgency: 'medium', repairRef: 'REP-227' },
  // 荒子川公園
  { id: 12628, status: 'confirmed', type: 'repair', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-081', facilityName: '砂場', facilityId: '07-510', vendor: '〇〇造園土木', createdDate: '2024/12/01', lastStatusChange: '2024/12/15', urgency: 'medium', repairRef: 'REP-228' },
  { id: 12629, status: 'confirmed', type: 'repair', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-082', facilityName: '橋梁', facilityId: '07-520', vendor: '△△建設', createdDate: '2024/12/01', lastStatusChange: '2024/12/15', urgency: 'high', repairRef: 'REP-229' },
  { id: 12630, status: 'confirmed', type: 'repair', parkRef: 'GS-gs3xyhbw', parkName: '荒子川公園', facilityRef: 'PF-demo-083', facilityName: '池', facilityId: '07-530', vendor: '〇〇造園土木', createdDate: '2024/12/01', lastStatusChange: '2024/12/15', urgency: 'low', repairRef: 'REP-230' },
  // 戸田川緑地
  { id: 12631, status: 'confirmed', type: 'repair', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-091', facilityName: '健康遊具', facilityId: '08-610', vendor: '△△建設', createdDate: '2025/01/10', lastStatusChange: '2025/01/25', urgency: 'low', repairRef: 'REP-231' },
  { id: 12632, status: 'confirmed', type: 'repair', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-092', facilityName: '野鳥観察所', facilityId: '08-620', vendor: '〇〇造園土木', createdDate: '2025/01/10', lastStatusChange: '2025/01/25', urgency: 'medium', repairRef: 'REP-232' },
  { id: 12633, status: 'confirmed', type: 'repair', parkRef: 'GS-3d67hwf5', parkName: '戸田川緑地', facilityRef: 'PF-demo-093', facilityName: '車止め', facilityId: '08-630', vendor: '△△建設', createdDate: '2025/01/10', lastStatusChange: '2025/01/25', urgency: 'low', repairRef: 'REP-233' },
  // 千種公園
  { id: 12634, status: 'confirmed', type: 'repair', parkRef: 'GS-rtljov09', parkName: '千種公園', facilityRef: 'PF-demo-101', facilityName: 'クライミング遊具', facilityId: '02-410', vendor: '〇〇造園土木', createdDate: '2025/03/01', lastStatusChange: '2025/03/15', urgency: 'low', repairRef: 'REP-234' },
  { id: 12635, status: 'confirmed', type: 'repair', parkRef: 'GS-rtljov09', parkName: '千種公園', facilityRef: 'PF-demo-102', facilityName: '倉庫', facilityId: '02-420', vendor: '△△建設', createdDate: '2025/03/01', lastStatusChange: '2025/03/15', urgency: 'low', repairRef: 'REP-235' },
  // 徳川園
  { id: 12636, status: 'confirmed', type: 'repair', parkRef: 'GS-ful7d9lw', parkName: '徳川園', facilityRef: 'PF-demo-111', facilityName: '茶室', facilityId: '06-710', vendor: '〇〇造園土木', createdDate: '2025/04/01', lastStatusChange: '2025/04/15', urgency: 'low', repairRef: 'REP-236' },
  { id: 12637, status: 'confirmed', type: 'repair', parkRef: 'GS-ful7d9lw', parkName: '徳川園', facilityRef: 'PF-demo-112', facilityName: '池', facilityId: '06-720', vendor: '△△建設', createdDate: '2025/04/01', lastStatusChange: '2025/04/15', urgency: 'low', repairRef: 'REP-237' },
  // 猪高緑地
  { id: 12638, status: 'confirmed', type: 'repair', parkRef: 'GS-7f2voyoy', parkName: '猪高緑地', facilityRef: 'PF-demo-121', facilityName: '消防団詰所', facilityId: '10-510', vendor: '〇〇造園土木', createdDate: '2024/11/01', lastStatusChange: '2024/11/15', urgency: 'low', repairRef: 'REP-238' },
  { id: 12639, status: 'confirmed', type: 'repair', parkRef: 'GS-7f2voyoy', parkName: '猪高緑地', facilityRef: 'PF-demo-122', facilityName: '園路', facilityId: '10-520', vendor: '△△建設', createdDate: '2024/11/01', lastStatusChange: '2024/11/15', urgency: 'medium', repairRef: 'REP-239' },
];

// ── Auto-generate cases for every park-facility so all inspection/repair rows are clickable ──
import { DUMMY_PARK_FACILITIES } from './dummyParkFacilities';
import { DUMMY_FACILITIES, PARK_NAME_LOOKUP } from './dummyFacilities';

const URGENCIES: Array<'high' | 'medium' | 'low'> = ['low', 'medium', 'high'];
const STATUSES: Array<'pending' | 'returned' | 'confirmed'> = ['confirmed', 'confirmed', 'confirmed', 'pending', 'returned'];

let autoId = 70001;

function pushFacilityCases(
  facilityId: string, facilityName: string, facilityDisplayId: string,
  parkRef: string, parkName: string, idx: number,
) {
  const vendor = idx % 2 === 0 ? '〇〇造園土木' : '△△建設';
  const altVendor = vendor === '〇〇造園土木' ? '△△建設' : '〇〇造園土木';
  // 2 inspection + 2 repair cases per facility (covers all generated records)
  for (let i = 0; i < 2; i++) {
    DUMMY_CASES.push({
      id: autoId++,
      status: STATUSES[(idx + i) % STATUSES.length],
      type: 'inspection',
      parkRef,
      parkName,
      facilityRef: facilityId,
      facilityName,
      facilityId: facilityDisplayId,
      vendor: i === 0 ? vendor : altVendor,
      createdDate: '2025/07/29',
      lastStatusChange: '2025/07/29',
      urgency: URGENCIES[(idx + i) % URGENCIES.length],
    });
  }
  for (let i = 0; i < 2; i++) {
    DUMMY_CASES.push({
      id: autoId++,
      status: STATUSES[(idx + i + 1) % STATUSES.length],
      type: 'repair',
      parkRef,
      parkName,
      facilityRef: facilityId,
      facilityName,
      facilityId: facilityDisplayId,
      vendor: i === 0 ? vendor : altVendor,
      createdDate: '2025/07/29',
      lastStatusChange: '2025/07/29',
      urgency: URGENCIES[(idx + i + 1) % URGENCIES.length],
    });
  }
}

// Park facilities
DUMMY_PARK_FACILITIES.forEach((feature, idx) => {
  const fac = feature.properties;
  const parkName = PARK_NAME_LOOKUP[fac.greenSpaceRef ?? ''] ?? '';
  pushFacilityCases(fac.id, fac.name, fac.facilityId ?? '', fac.greenSpaceRef ?? '', parkName, idx);
});

// Curated facilities
DUMMY_FACILITIES.forEach((fac, idx) => {
  const parkName = PARK_NAME_LOOKUP[fac.greenSpaceRef ?? ''] ?? '';
  pushFacilityCases(fac.id, fac.name, fac.facilityId ?? fac.id, fac.greenSpaceRef ?? '', parkName, idx);
});

/** Find a case by ID (compares as string for flexibility) */
export function getCaseById(id: number | string): DummyCase | undefined {
  return DUMMY_CASES.find((c) => String(c.id) === String(id));
}

/** Get all cases for a given facility reference (e.g. 'PF-demo-011') */
export function getCasesByFacility(facilityRef: string): DummyCase[] {
  return DUMMY_CASES.filter((c) => c.facilityRef === facilityRef);
}

/** Get counts by status */
export function getCaseCounts(cases: DummyCase[]) {
  return {
    all: cases.length,
    pending: cases.filter((c) => c.status === 'pending').length,
    returned: cases.filter((c) => c.status === 'returned').length,
    confirmed: cases.filter((c) => c.status === 'confirmed').length,
  };
}

