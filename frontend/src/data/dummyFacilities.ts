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
  facilityClassification?: string; // 施設分類 (playEquipment, sportsFacility, etc.)
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
  // ── 鶴舞公園 (GS-zxpnkee2) ──────────────────────────────────────
  { id: 'PF-demo-001', facilityId: '03-210', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '1998-04-01', quantity: 1, designLife: 28, lastInspectionDate: '2025-06-15', lastRepairDate: '2023-04-10', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2028, estimatedCost: 3200000, notes: 'H10年度公園整備工事により設置 バリアフリー対応済（多目的トイレ1室含む）' },
  { id: 'PF-demo-002', facilityId: '03-220', name: '複合遊具A', category: 'combinedPlay', facilityClassification: 'playEquipment', subItem: 'スチール・FRP', mainMaterial: 'スチール', quantity: 1, conditionGrade: 'C', structureRank: 'C', wearRank: 'C', safetyConcern: true, status: 'underRepair', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2005-03-01', designLife: 21, lastInspectionDate: '2025-09-01', lastRepairDate: '2025-10-01', managementType: '予防保全', urgencyLevel: 'high', countermeasure: '更新', plannedYear: 2026, estimatedCost: 8500000, notes: '安全懸念あり H17年度公園施設整備工事により設置 支柱接合部に腐食進行（R7点検指摘）' },
  { id: 'PF-demo-003', facilityId: '03-230', name: 'ベンチ群A', category: 'bench', facilityClassification: 'restFacility', subItem: '背付き', mainMaterial: '木製', quantity: 12, conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'suspended', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2010-04-01', designLife: 16, lastInspectionDate: '2025-06-15', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2027, estimatedCost: 1474000, notes: '国庫補助 Aゾーン （テーブル3✕ベンチ4）H22年度公園施設更新工事により設置 座板の劣化が進行しており一部使用停止中' },
  { id: 'PF-demo-004', facilityId: '03-240', name: 'あずま屋', category: 'gazebo', facilityClassification: 'restFacility', subItem: '四阿', mainMaterial: '木製', conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2015-10-01', quantity: 1, designLife: 10, lastInspectionDate: '2025-06-15', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 2100000, notes: 'H27年度公園施設更新工事により設置 屋根材：銅板葺き' },
  { id: 'PF-demo-005', facilityId: '03-250', name: '公園灯', category: 'parkLight', facilityClassification: 'management', subItem: 'LED', mainMaterial: 'アルミ', quantity: 24, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '2020-03-01', designLife: 6, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 960000, notes: 'R2年度LED化改修工事により既存水銀灯から更新 タイマー制御（日没〜23:00点灯）' },
  { id: 'PF-demo-006', facilityId: '03-260', name: '噴水', category: 'fountain', facilityClassification: 'landscape', subItem: '循環式', mainMaterial: '御影石', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '昭和区', greenSpaceRef: 'GS-zxpnkee2', dateInstalled: '1998-04-01', designLife: 28, lastInspectionDate: '2025-06-15', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2030, estimatedCost: 4500000, notes: 'H10年度公園整備工事により設置 循環ポンプR5年度交換済 冬季（12月〜2月）運転停止' },

  // ── 名城公園 (GS-nliigh01) ──────────────────────────────────────
  { id: 'PF-demo-011', facilityId: '05-780', name: 'ピクニックテーブル', category: 'picnicTable', facilityClassification: 'restFacility', subItem: '木製', mainMaterial: '金属(ステンレス以外)', quantity: 3, structureRank: 'A', wearRank: 'C', status: 'active', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2015-03-05', designLife: 11, lastInspectionDate: '2025-03-05', managementType: '予防保全', urgencyLevel: 'high', countermeasure: '更新', plannedYear: 2027, estimatedCost: 1474000, notes: '国庫補助 Aゾーン （テーブル3✕ベンチ4）H26年度公園施設更新工事により設置' },
  { id: 'PF-demo-012', facilityId: '05-760', name: 'ベンチ', category: 'bench', facilityClassification: 'restFacility', subItem: '背付き', mainMaterial: '再生木材', quantity: 4, structureRank: 'A', wearRank: 'D', status: 'underRepair', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2015-03-05', designLife: 11, lastInspectionDate: '2025-03-05', managementType: '予防保全', urgencyLevel: 'high', countermeasure: '更新', plannedYear: 2027, estimatedCost: 1474000, notes: 'H26年度公園施設更新工事により設置 再生木材使用（エコ対応）座面の割れが複数箇所で確認されており補修予定' },
  { id: 'PF-demo-013', facilityId: '05-710', name: 'パーゴラ', category: 'pergola', facilityClassification: 'restFacility', subItem: '藤棚', mainMaterial: 'コンクリート', quantity: 1, structureRank: 'C', wearRank: 'C', status: 'suspended', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '1991-03-31', designLife: 35, lastInspectionDate: '2025-03-05', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2027, estimatedCost: 1474000, notes: 'H3年度設置 柱基礎部のひび割れ及び鉄筋露出あり 藤の植替えはH28年度実施 倒壊防止のため使用停止中' },
  { id: 'PF-demo-014', facilityId: '05-790', name: '水飲み場', category: 'waterFountain', facilityClassification: 'convenience', subItem: 'ステンレス', mainMaterial: 'ステンレス', quantity: 3, structureRank: 'A', wearRank: 'A', status: 'active', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2018-04-01', designLife: 8, lastInspectionDate: '2025-07-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2033, estimatedCost: 480000, notes: 'H30年度公園施設更新工事により設置 ペット用水飲み併設タイプ' },
  { id: 'PF-demo-015', facilityId: '05-800', name: '花壇', category: 'flowerBed', facilityClassification: 'landscape', subItem: 'レンガ囲い', mainMaterial: 'レンガ', quantity: 5, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '北区', greenSpaceRef: 'GS-nliigh01', dateInstalled: '2018-04-01', designLife: 8, lastInspectionDate: '2025-07-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2038, estimatedCost: 320000, notes: 'H30年度景観整備工事により設置 地元ボランティア団体による維持管理協定あり（名城花の会）' },

  // ── 東山公園 (GS-4g77l6x7) ──────────────────────────────────────
  { id: 'PF-demo-021', facilityId: '01-310', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2000-04-01', quantity: 1, designLife: 26, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2030, estimatedCost: 3200000, notes: 'H12年度動植物園再整備工事により設置 男女各2室＋多目的1室 外壁タイルの浮きが一部確認されている' },
  { id: 'PF-demo-022', facilityId: '01-320', name: 'ブランコ', category: 'swing', facilityClassification: 'playEquipment', subItem: '2連', mainMaterial: 'スチール', quantity: 2, conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'active', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2008-04-01', designLife: 18, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 1200000, notes: 'H20年度遊具更新工事により設置 2連式（幼児用・児童用各1基）チェーン摩耗によりR6年度交換実施' },
  { id: 'PF-demo-023', facilityId: '01-330', name: '掲示板', category: 'bulletinBoard', facilityClassification: 'management', subItem: 'アルミ製', mainMaterial: 'アルミ', quantity: 6, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2019-04-01', designLife: 7, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2034, estimatedCost: 360000, notes: 'R1年度管理施設整備工事により設置 園内案内図・利用案内を掲示 多言語対応（日英中韓）' },
  { id: 'PF-demo-024', facilityId: '01-340', name: '自然生態園', category: 'ecoPark', facilityClassification: 'education', subItem: 'ビオトープ', mainMaterial: '-', quantity: 1, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '千種区', greenSpaceRef: 'GS-4g77l6x7', dateInstalled: '2010-04-01', designLife: 16, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 5600000, notes: 'H22年度教育施設整備工事により設置 環境省補助事業 メダカ・ホタル等の生息環境を維持管理 年間利用者約15,000人' },

  // ── 白川公園 (GS-es1u7z8r) ──────────────────────────────────────
  { id: 'PF-demo-031', facilityId: '09-410', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '2015-04-01', quantity: 1, designLife: 11, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2045, estimatedCost: 3200000, notes: 'H27年度白川公園再整備工事により設置 科学館来園者対応のためトイレ容量を増設 男3室・女5室・多目的1室' },
  { id: 'PF-demo-032', facilityId: '09-420', name: '公園灯', category: 'parkLight', facilityClassification: 'management', subItem: 'LED', mainMaterial: 'アルミ', quantity: 16, conditionGrade: 'A', structureRank: 'A', wearRank: 'B', status: 'underRepair', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '2020-04-01', designLife: 6, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 640000, notes: 'R2年度LED化改修工事により設置 一部灯具のちらつき発生のため補修中（R7.8〜）' },
  { id: 'PF-demo-033', facilityId: '09-430', name: '園路', category: 'gardenPath', facilityClassification: 'pathPlaza', subItem: 'インターロッキング', mainMaterial: 'コンクリート', conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '2015-04-01', quantity: 1, designLife: 11, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 1200000, notes: 'H27年度白川公園再整備工事により設置 延長約450m 一部区間で根上がりによる段差あり（北側園路沿い）' },
  { id: 'PF-demo-034', facilityId: '09-440', name: '記念碑', category: 'monument', facilityClassification: 'landscape', subItem: '石碑', mainMaterial: '御影石', quantity: 1, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-es1u7z8r', dateInstalled: '1985-04-01', designLife: 41, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '経過観察', plannedYear: 2040, estimatedCost: 500000, notes: 'S60年度設置 市制100周年記念碑 碑文の文字摩耗はあるが構造上問題なし' },

  // ── 庄内緑地公園 (GS-9ego0pvp) ──────────────────────────────────
  { id: 'PF-demo-041', facilityId: '05-510', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'suspended', ward: '西区', greenSpaceRef: 'GS-9ego0pvp', dateInstalled: '2003-04-01', quantity: 1, designLife: 23, lastInspectionDate: '2025-06-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 3200000, notes: 'H15年度公園整備工事により設置 配管老朽化により漏水が頻発 R7年度より使用停止・仮設トイレで代替中' },
  { id: 'PF-demo-042', facilityId: '05-520', name: 'テニスコート', category: 'tennisCourt', facilityClassification: 'sportsFacility', subItem: '人工芝', mainMaterial: '合成樹脂', conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '西区', greenSpaceRef: 'GS-9ego0pvp', dateInstalled: '2018-04-01', quantity: 4, designLife: 8, lastInspectionDate: '2025-06-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2033, estimatedCost: 5600000, notes: 'H30年度運動施設改修工事により設置 4面（うち1面ナイター照明付）指定管理者による運営' },
  { id: 'PF-demo-043', facilityId: '05-530', name: '防災備蓄倉庫', category: 'disasterWarehouse', facilityClassification: 'disasterRelief', subItem: 'スチール造', mainMaterial: 'スチール', quantity: 1, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '西区', greenSpaceRef: 'GS-9ego0pvp', dateInstalled: '2016-04-01', designLife: 10, lastInspectionDate: '2025-06-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2036, estimatedCost: 2800000, notes: 'H28年度防災施設整備工事により設置 備蓄品：毛布500枚・飲料水2,000L・簡易トイレ100個 西区防災会議管轄' },
  { id: 'PF-demo-044', facilityId: '05-540', name: '広場', category: 'plaza', facilityClassification: 'pathPlaza', subItem: '芝生', mainMaterial: '-', quantity: 1, conditionGrade: 'A', structureRank: 'A', wearRank: 'B', status: 'active', ward: '西区', greenSpaceRef: 'GS-9ego0pvp', dateInstalled: '2018-04-01', designLife: 8, lastInspectionDate: '2025-06-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2033, estimatedCost: 1200000, notes: 'H30年度公園再整備工事により設置 面積約3,200㎡ 芝生の傷みが激しい区画はR6年度に張替え実施' },

  // ── 大高緑地公園 (GS-auy42b1p) ──────────────────────────────────
  { id: 'PF-demo-051', facilityId: '13-610', name: 'トイレA棟', category: 'toilet', facilityClassification: 'convenience', subItem: 'RC造', mainMaterial: 'コンクリート', conditionGrade: 'C', structureRank: 'C', wearRank: 'C', status: 'underRepair', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '1995-04-01', quantity: 1, designLife: 31, lastInspectionDate: '2025-04-01', managementType: '予防保全', urgencyLevel: 'high', countermeasure: '更新', plannedYear: 2026, estimatedCost: 4800000, notes: 'H7年度設置 外壁コンクリートの剥落及び鉄筋露出が複数箇所で確認 配管漏水あり R8年度建替え予定' },
  { id: 'PF-demo-052', facilityId: '13-620', name: 'すべり台', category: 'slide', facilityClassification: 'playEquipment', subItem: 'ステンレス', mainMaterial: 'ステンレス', quantity: 2, conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '2010-04-01', designLife: 16, lastInspectionDate: '2025-04-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2030, estimatedCost: 2500000, notes: 'H22年度遊具更新工事により設置 ローラーすべり台（延長12m）＋幼児用すべり台（延長3m）の2基' },
  { id: 'PF-demo-053', facilityId: '13-630', name: 'あずま屋A', category: 'gazebo', facilityClassification: 'restFacility', subItem: '四阿', mainMaterial: '木製', conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'suspended', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '2008-04-01', quantity: 1, designLife: 18, lastInspectionDate: '2025-04-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 2100000, notes: 'H20年度公園施設更新工事により設置 木部の腐食が進行し屋根部材の一部欠損あり 安全確保のため使用停止措置' },
  { id: 'PF-demo-054', facilityId: '13-640', name: '野球場', category: 'baseballField', facilityClassification: 'sportsFacility', subItem: 'クレー舗装', mainMaterial: '-', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'active', ward: '緑区', greenSpaceRef: 'GS-auy42b1p', dateInstalled: '2000-04-01', designLife: 26, lastInspectionDate: '2025-04-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 12000000, notes: 'H12年度運動施設整備工事により設置 両翼92m・中堅120m 防球ネットH25年度更新済 グラウンド表面の不陸が目立つ' },

  // ── 久屋大通公園 (GS-byrogagk) ──────────────────────────────────
  { id: 'PF-demo-061', facilityId: '11-710', name: '公園灯', category: 'parkLight', facilityClassification: 'management', subItem: 'LED', mainMaterial: 'アルミ', quantity: 40, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', designLife: 5, lastInspectionDate: '2025-09-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 1600000, notes: 'R2年度久屋大通公園リニューアル工事により設置 デザイン照明（景観配慮型）高さ4.5m ソーラー併用タイプ10基含む' },
  { id: 'PF-demo-062', facilityId: '11-720', name: 'ベンチ群', category: 'bench', facilityClassification: 'restFacility', subItem: '背付き', mainMaterial: '木製・スチール', quantity: 30, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'underRepair', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', designLife: 5, lastInspectionDate: '2025-09-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 3600000, notes: 'R2年度リニューアル工事により設置 デザインベンチ（木製座面＋スチールフレーム）一部塗装の剥がれにより補修中' },
  { id: 'PF-demo-063', facilityId: '11-730', name: '舗装路面', category: 'pavement', facilityClassification: 'pathPlaza', subItem: 'インターロッキング', mainMaterial: 'コンクリート', conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', quantity: 1, designLife: 5, lastInspectionDate: '2025-09-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2040, estimatedCost: 2400000, notes: 'R2年度リニューアル工事により設置 透水性インターロッキングブロック使用 テレビ塔〜栄間の約800m区間' },
  { id: 'PF-demo-064', facilityId: '11-740', name: '時計', category: 'clock', facilityClassification: 'convenience', subItem: '電波式', mainMaterial: 'ステンレス', quantity: 2, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '中区', greenSpaceRef: 'GS-byrogagk', dateInstalled: '2020-09-01', designLife: 5, lastInspectionDate: '2025-09-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 480000, notes: 'R2年度リニューアル工事により設置 電波時計（自動時刻補正）温湿度表示付き' },

  // ── 瑞穂公園 (GS-cfam78i3) ──────────────────────────────────────
  { id: 'PF-demo-071', facilityId: '04-410', name: 'サッカー場', category: 'soccerField', facilityClassification: 'sportsFacility', subItem: '天然芝', mainMaterial: '-', quantity: 1, conditionGrade: 'A', structureRank: 'A', wearRank: 'B', status: 'active', ward: '瑞穂区', greenSpaceRef: 'GS-cfam78i3', dateInstalled: '2012-04-01', designLife: 14, lastInspectionDate: '2025-07-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2032, estimatedCost: 15000000, notes: 'H24年度運動施設整備工事により設置 天然芝（ティフトン419）105m✕68m ナイター照明6基 年2回芝生更新' },
  { id: 'PF-demo-072', facilityId: '04-420', name: '駐車場', category: 'parking', facilityClassification: 'convenience', subItem: 'アスファルト', mainMaterial: 'アスファルト', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'active', ward: '瑞穂区', greenSpaceRef: 'GS-cfam78i3', dateInstalled: '2005-04-01', designLife: 21, lastInspectionDate: '2025-07-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 6000000, notes: 'H17年度公園整備工事により設置 収容台数120台 身障者用3台 路面のひび割れ・わだち掘れが進行' },
  { id: 'PF-demo-073', facilityId: '04-430', name: '柵・フェンス', category: 'fence', facilityClassification: 'management', subItem: 'メッシュフェンス', mainMaterial: 'スチール', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'underRepair', ward: '瑞穂区', greenSpaceRef: 'GS-cfam78i3', dateInstalled: '2005-04-01', designLife: 21, lastInspectionDate: '2025-07-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2027, estimatedCost: 2400000, notes: 'H17年度公園整備工事により設置 延長約320m 高さ1.8m 腐食による支柱の傾きが3箇所確認され部分補修中' },

  // ── 荒子川公園 (GS-gs3xyhbw) ────────────────────────────────────
  { id: 'PF-demo-081', facilityId: '07-510', name: '砂場', category: 'sandbox', facilityClassification: 'playEquipment', subItem: '柵付き', mainMaterial: '-', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'active', ward: '中川区', greenSpaceRef: 'GS-gs3xyhbw', dateInstalled: '2008-04-01', designLife: 18, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 350000, notes: 'H20年度遊具更新工事により設置 猫侵入防止ネット付き（H29年度追加）砂の入替えは年1回実施' },
  { id: 'PF-demo-082', facilityId: '07-520', name: '橋梁', category: 'bridge', facilityClassification: 'pathPlaza', subItem: '木橋', mainMaterial: '木製', quantity: 1, conditionGrade: 'C', structureRank: 'C', wearRank: 'C', status: 'suspended', ward: '中川区', greenSpaceRef: 'GS-gs3xyhbw', dateInstalled: '2000-04-01', designLife: 26, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'high', countermeasure: '更新', plannedYear: 2026, estimatedCost: 8000000, notes: 'H12年度公園整備工事により設置 橋長8.5m・幅員2.0m 主桁の腐朽が著しく荷重制限を超える恐れがあるため通行止め措置中 R8年度架替え予定' },
  { id: 'PF-demo-083', facilityId: '07-530', name: '池', category: 'pond', facilityClassification: 'landscape', subItem: '修景池', mainMaterial: 'コンクリート', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '中川区', greenSpaceRef: 'GS-gs3xyhbw', dateInstalled: '2000-04-01', designLife: 26, lastInspectionDate: '2025-05-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '経過観察', plannedYear: 2035, estimatedCost: 3000000, notes: 'H12年度公園整備工事により設置 面積約800㎡ 水深0.3m〜0.8m 循環ろ過装置付き 池底防水シートの劣化が進行' },

  // ── 戸田川緑地 (GS-3d67hwf5) ────────────────────────────────────
  { id: 'PF-demo-091', facilityId: '08-610', name: '健康遊具', category: 'healthExercise', facilityClassification: 'playEquipment', subItem: '背伸ばし・ぶら下がり', mainMaterial: 'スチール', quantity: 6, conditionGrade: 'A', structureRank: 'A', wearRank: 'B', status: 'active', ward: '港区', greenSpaceRef: 'GS-3d67hwf5', dateInstalled: '2018-04-01', designLife: 8, lastInspectionDate: '2025-06-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2033, estimatedCost: 1800000, notes: 'H30年度健康増進施設整備工事により設置 背伸ばし2基・ぶら下がり2基・腹筋台1基・平均台1基の計6基 利用案内看板付き' },
  { id: 'PF-demo-092', facilityId: '08-620', name: '野鳥観察所', category: 'birdObservatory', facilityClassification: 'education', subItem: '木造', mainMaterial: '木製', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'active', ward: '港区', greenSpaceRef: 'GS-3d67hwf5', dateInstalled: '2005-04-01', designLife: 21, lastInspectionDate: '2025-06-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 3200000, notes: 'H17年度教育施設整備工事により設置 定員15名 床板の腐食が進行しており一部補強材を追加 双眼鏡2台設置（港区野鳥の会寄贈）' },
  { id: 'PF-demo-093', facilityId: '08-630', name: '車止め', category: 'bollard', facilityClassification: 'management', subItem: 'スチール', mainMaterial: 'スチール', quantity: 8, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '港区', greenSpaceRef: 'GS-3d67hwf5', dateInstalled: '2018-04-01', designLife: 8, lastInspectionDate: '2025-06-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2033, estimatedCost: 240000, notes: 'H30年度管理施設整備工事により設置 可動式4基・固定式4基 緊急車両進入時は可動式を開放' },

  // ── 千種公園 (GS-rtljov09) ──────────────────────────────────────
  { id: 'PF-demo-101', facilityId: '02-410', name: 'クライミング遊具', category: 'climbingGym', facilityClassification: 'playEquipment', subItem: 'ネット式', mainMaterial: 'ロープ・スチール', quantity: 1, conditionGrade: 'A', structureRank: 'A', wearRank: 'B', status: 'active', ward: '千種区', greenSpaceRef: 'GS-rtljov09', dateInstalled: '2019-04-01', designLife: 7, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2034, estimatedCost: 3500000, notes: 'R1年度遊具整備工事により設置 ネット式クライミング遊具（高さ3.5m）対象年齢6〜12歳 ロープの摩耗チェックを年2回実施' },
  { id: 'PF-demo-102', facilityId: '02-420', name: '倉庫', category: 'warehouse', facilityClassification: 'management', subItem: 'スチール造', mainMaterial: 'スチール', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '千種区', greenSpaceRef: 'GS-rtljov09', dateInstalled: '2005-04-01', designLife: 21, lastInspectionDate: '2025-08-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2030, estimatedCost: 1500000, notes: 'H17年度管理施設整備工事により設置 プレハブ型（3.6m✕5.4m）管理用資機材保管用 扉の開閉に不具合あり（R6年度調整済）' },

  // ── 徳川園 (GS-ful7d9lw) ───────────────────────────────────────
  { id: 'PF-demo-111', facilityId: '06-710', name: '茶室', category: 'teaRoom', facilityClassification: 'education', subItem: '木造', mainMaterial: '木製', quantity: 1, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '東区', greenSpaceRef: 'GS-ful7d9lw', dateInstalled: '2004-11-01', designLife: 22, lastInspectionDate: '2025-09-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2034, estimatedCost: 12000000, notes: 'H16年度徳川園再整備工事により設置 木造平屋建（数寄屋造り）定員20名 茶会・文化教室等に利用 畳の表替えR5年度実施済' },
  { id: 'PF-demo-112', facilityId: '06-720', name: '池', category: 'pond', facilityClassification: 'landscape', subItem: '回遊式庭園', mainMaterial: '-', quantity: 1, conditionGrade: 'A', structureRank: 'A', wearRank: 'A', status: 'active', ward: '東区', greenSpaceRef: 'GS-ful7d9lw', dateInstalled: '2004-11-01', designLife: 22, lastInspectionDate: '2025-09-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '経過観察', plannedYear: 2040, estimatedCost: 8000000, notes: 'H16年度徳川園再整備工事により設置 龍仙湖（面積約1,300㎡）尾張藩の大名庭園を復元 錦鯉約200匹放流 水質管理は月1回実施' },

  // ── 猪高緑地 (GS-7f2voyoy) ──────────────────────────────────────
  { id: 'PF-demo-121', facilityId: '10-510', name: '消防団詰所', category: 'fireBrigade', facilityClassification: 'disasterRelief', subItem: 'RC造', mainMaterial: 'コンクリート', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'B', status: 'active', ward: '名東区', greenSpaceRef: 'GS-7f2voyoy', dateInstalled: '2010-04-01', designLife: 16, lastInspectionDate: '2025-04-01', managementType: '予防保全', urgencyLevel: 'low', countermeasure: '更新', plannedYear: 2035, estimatedCost: 4500000, notes: 'H22年度防災施設整備工事により設置 名東消防団第3分団管轄 ポンプ車1台・資機材格納 年2回防災訓練実施' },
  { id: 'PF-demo-122', facilityId: '10-520', name: '園路', category: 'gardenPath', facilityClassification: 'pathPlaza', subItem: '砂利敷', mainMaterial: '砂利', quantity: 1, conditionGrade: 'B', structureRank: 'B', wearRank: 'C', status: 'active', ward: '名東区', greenSpaceRef: 'GS-7f2voyoy', dateInstalled: '2005-04-01', designLife: 21, lastInspectionDate: '2025-04-01', managementType: '予防保全', urgencyLevel: 'medium', countermeasure: '更新', plannedYear: 2028, estimatedCost: 1800000, notes: 'H17年度緑地整備工事により設置 延長約1,200m 自然散策路として利用 砂利流出が著しい区間あり（南側斜面沿い）補充を年1回実施' },
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

/** Category labels for display (sub-types within each classification) */
export const FACILITY_CATEGORY_LABELS: Record<string, string> = {
  // playEquipment 遊戯施設
  swing: 'ブランコ', slide: 'すべり台', climbingGym: 'クライミング遊具',
  sandbox: '砂場', combinedPlay: '複合遊具', healthExercise: '健康遊具',
  // sportsFacility 運動施設
  baseballField: '野球場', tennisCourt: 'テニスコート', soccerField: 'サッカー場',
  pool: 'プール', gateballField: 'ゲートボール場',
  // pathPlaza 園路広場
  plaza: '広場', pavement: '舗装路面', gardenPath: '園路', bridge: '橋梁',
  // restFacility 休養施設
  pergola: 'パーゴラ', gazebo: 'あずま屋', bench: 'ベンチ', picnicTable: 'ピクニックテーブル',
  // landscape 修景施設
  fountain: '噴水', pond: '池', monument: '記念碑', flowerBed: '花壇',
  // convenience 便益施設
  toilet: 'トイレ', waterFountain: '水飲み場', clock: '時計', parking: '駐車場',
  // management 管理施設
  warehouse: '倉庫', bulletinBoard: '掲示板', bollard: '車止め',
  parkLight: '公園灯', fence: '柵・フェンス',
  // education 教養施設
  ecoPark: '自然生態園', birdObservatory: '野鳥観察所', teaRoom: '茶室',
  // disasterRelief 災害応急対策施設
  disasterWarehouse: '防災備蓄倉庫', fireBrigade: '消防団詰所',
  // other その他
  other: 'その他',
};

/** Facility classification labels (施設分類) */
export const FACILITY_CLASSIFICATION_LABELS: Record<string, string> = {
  playEquipment: '遊戯施設',
  sportsFacility: '運動施設',
  pathPlaza: '園路広場',
  restFacility: '休養施設',
  landscape: '修景施設',
  convenience: '便益施設',
  management: '管理施設',
  education: '教養施設',
  disasterRelief: '災害応急対策施設',
  other: 'その他',
};

/** Status labels and badge styles */
export const FACILITY_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: '使用中', className: 'bg-[#22C55E] text-white' },
  underRepair: { label: '修理中', className: 'bg-[#FACC15] text-[#713F12]' },
  inactive: { label: '修理中', className: 'bg-[#FACC15] text-[#713F12]' },
  suspended: { label: '停止使用', className: 'bg-[#F87171] text-[#7F1D1D]' },
  removed: { label: '停止使用', className: 'bg-[#F87171] text-[#7F1D1D]' },
};

/** Park name lookup from greenSpaceRef */
export const PARK_NAME_LOOKUP: Record<string, string> = {
  'GS-zxpnkee2': '鶴舞公園',
  'GS-nliigh01': '名城公園',
  'GS-4g77l6x7': '東山動植物園',
  'GS-es1u7z8r': '白川公園',
  'GS-9ego0pvp': '庄内緑地公園',
  'GS-auy42b1p': '大高緑地公園',
  'GS-gs3xyhbw': '荒子川公園',
  'GS-3d67hwf5': '戸田川緑地',
  'GS-byrogagk': '久屋大通公園',
  'GS-ful7d9lw': '徳川園',
  'GS-7f2voyoy': '猪高緑地',
  'GS-x1q5e2te': '牧野ヶ池緑地',
  'GS-ldnfwyur': '小幡緑地公園',
  'GS-9exy95g1': '笠寺公園',
  'GS-xk4kyf2q': '志賀公園',
  'GS-cfam78i3': '瑞穂公園',
  'GS-gul3d3ul': '熱田神宮公園',
  'GS-rtljov09': '千種公園',
};
