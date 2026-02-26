/**
 * Dummy facility inspection data for demo.
 * Matches the Figma "Facility page" design with structure/wear rank columns.
 * Each inspection is linked to a facility (facilityId).
 */

export interface DummyFacilityInspection {
  id: string;
  facilityId: string;
  inspectionDate: string;
  inspector: string;
  content: string;
  structureRank?: string; // A, B, C, D
  structureNotes?: string;
  wearRank?: string; // A, B, C, D
  wearNotes?: string;
}

export const DUMMY_FACILITY_INSPECTIONS: DummyFacilityInspection[] = [
  // ── 名城公園 テーブル (PF-demo-011, facilityId: 05-780) — Figma reference ──
  { id: '23563', facilityId: 'PF-demo-011', inspectionDate: '2025-07-29', inspector: 'OO造園土木', content: '消耗部材交換', structureRank: 'A', structureNotes: '', wearRank: 'C', wearNotes: '' },
  { id: '12357', facilityId: 'PF-demo-011', inspectionDate: '2025-07-29', inspector: 'OO造園土木', content: '消耗部材交換', structureRank: 'A', structureNotes: '', wearRank: 'B', wearNotes: '' },

  // ── 名城公園 ベンチ (PF-demo-012, facilityId: 05-760) ──
  { id: '23564', facilityId: 'PF-demo-012', inspectionDate: '2025-07-29', inspector: 'OO造園土木', content: '消耗部材交換', structureRank: 'A', structureNotes: '', wearRank: 'D', wearNotes: '座板腐食' },
  { id: '12358', facilityId: 'PF-demo-012', inspectionDate: '2024-08-15', inspector: '名古屋緑化', content: '定期点検', structureRank: 'A', structureNotes: '', wearRank: 'C', wearNotes: '' },

  // ── 名城公園 パーゴラ (PF-demo-013, facilityId: 05-710) ──
  { id: '23565', facilityId: 'PF-demo-013', inspectionDate: '2025-07-29', inspector: 'OO造園土木', content: '定期点検', structureRank: 'C', structureNotes: '基礎ひび割れ', wearRank: 'C', wearNotes: '' },

  // ── 鶴舞公園 (PF-demo-001~005) ──
  { id: '10001', facilityId: 'PF-demo-001', inspectionDate: '2025-06-15', inspector: '名古屋緑化', content: '定期点検', structureRank: 'B', structureNotes: '', wearRank: 'B', wearNotes: '' },
  { id: '10002', facilityId: 'PF-demo-001', inspectionDate: '2024-06-10', inspector: '名古屋緑化', content: '定期点検', structureRank: 'B', structureNotes: '', wearRank: 'A', wearNotes: '' },
  { id: '10003', facilityId: 'PF-demo-002', inspectionDate: '2025-09-01', inspector: 'OO造園土木', content: '緊急点検', structureRank: 'C', structureNotes: '接合部腐食', wearRank: 'C', wearNotes: '塗装剥離' },
  { id: '10004', facilityId: 'PF-demo-003', inspectionDate: '2025-06-15', inspector: '名古屋緑化', content: '定期点検', structureRank: 'B', structureNotes: '', wearRank: 'C', wearNotes: '' },
  { id: '10005', facilityId: 'PF-demo-004', inspectionDate: '2025-06-15', inspector: '名古屋緑化', content: '定期点検', structureRank: 'A', structureNotes: '', wearRank: 'A', wearNotes: '' },
  { id: '10006', facilityId: 'PF-demo-005', inspectionDate: '2025-08-01', inspector: '名古屋緑化', content: '定期点検', structureRank: 'A', structureNotes: '', wearRank: 'A', wearNotes: '' },

  // ── 東山動植物園 (PF-demo-021~023) ──
  { id: '10011', facilityId: 'PF-demo-021', inspectionDate: '2025-05-01', inspector: '名古屋緑化', content: '定期点検', structureRank: 'B', structureNotes: '', wearRank: 'B', wearNotes: '' },
  { id: '10012', facilityId: 'PF-demo-022', inspectionDate: '2025-05-01', inspector: '名古屋緑化', content: '定期点検', structureRank: 'C', structureNotes: '', wearRank: 'C', wearNotes: '座面劣化' },
  { id: '10013', facilityId: 'PF-demo-023', inspectionDate: '2025-05-01', inspector: '名古屋緑化', content: '定期点検', structureRank: 'A', structureNotes: '', wearRank: 'A', wearNotes: '' },

  // ── 白川公園 (PF-demo-031~033) ──
  { id: '10021', facilityId: 'PF-demo-031', inspectionDate: '2025-08-01', inspector: 'OO造園土木', content: '定期点検', structureRank: 'A', structureNotes: '', wearRank: 'A', wearNotes: '' },
  { id: '10022', facilityId: 'PF-demo-032', inspectionDate: '2025-08-01', inspector: 'OO造園土木', content: '定期点検', structureRank: 'A', structureNotes: '', wearRank: 'B', wearNotes: '' },

  // ── 大高緑地公園 (PF-demo-051~053) ──
  { id: '10031', facilityId: 'PF-demo-051', inspectionDate: '2025-04-01', inspector: '名古屋緑化', content: '緊急点検', structureRank: 'C', structureNotes: '外壁ひび割れ', wearRank: 'C', wearNotes: '' },
  { id: '10032', facilityId: 'PF-demo-052', inspectionDate: '2025-04-01', inspector: '名古屋緑化', content: '定期点検', structureRank: 'B', structureNotes: '', wearRank: 'B', wearNotes: '' },
  { id: '10033', facilityId: 'PF-demo-053', inspectionDate: '2025-04-01', inspector: '名古屋緑化', content: '定期点検', structureRank: 'B', structureNotes: '', wearRank: 'B', wearNotes: '' },

  // ── 久屋大通公園 (PF-demo-061~063) ──
  { id: '10041', facilityId: 'PF-demo-061', inspectionDate: '2025-09-01', inspector: 'OO造園土木', content: '定期点検', structureRank: 'A', structureNotes: '', wearRank: 'A', wearNotes: '' },
  { id: '10042', facilityId: 'PF-demo-062', inspectionDate: '2025-09-01', inspector: 'OO造園土木', content: '定期点検', structureRank: 'A', structureNotes: '', wearRank: 'A', wearNotes: '' },
];

/** Get facility inspections by facility ID */
export function getDummyFacilityInspections(facilityId: string): DummyFacilityInspection[] {
  return DUMMY_FACILITY_INSPECTIONS.filter((i) => i.facilityId === facilityId);
}
