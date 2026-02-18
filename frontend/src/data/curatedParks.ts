// Curated list of 18 major parks for the demo
// IDs match real DB records (greenspace_assets)
// Used in ParkListPage (park management) and MapView (greenspace polygon filter)
// Ledger fields based on Nagoya City park management ledger (公園台帳)

export type CuratedPark = {
  id: string;
  no: string;
  displayName: string;
  ward: string;
  address: string;
  areaHa: number;
  greenSpaceType: string;
  areaM2: number;
  status: string;
  openingYear: string;
  establishedDate: string;
  planNumber: string;
  plannedAreaHa: number;
  urbanPlanNumber: string;
  planDecisionDate: string;
  acquisitionMethod: string;
  category: string;
  schoolDistrict: string;
  paidFacility: string;
  disasterFacility: string;
  managementOffice: string;
  notes: string;
};

export const CURATED_PARKS: readonly CuratedPark[] = [
  {
    id: 'GS-4g77l6x7', no: '1', displayName: '東山公園', ward: '千種区',
    address: '名古屋市千種区東山元町三丁目', areaHa: 89.49, greenSpaceType: 'park', areaM2: 894903, status: 'active',
    openingYear: 'S12', establishedDate: 'S12.03.28', planNumber: '5.5.1', plannedAreaHa: 89.49,
    urbanPlanNumber: '228.9', planDecisionDate: 'S12.03.01', acquisitionMethod: '借寄',
    category: '動', schoolDistrict: '東山星ヶ丘見付', paidFacility: '動',
    disasterFacility: '広避 応給', managementOffice: '千種土木事務所',
    notes: '有料区域(61.61ha)千種区・名東区・天白区に跨る',
  },
  {
    id: 'GS-nliigh01', no: '2', displayName: '名城公園', ward: '北区',
    address: '名古屋市北区名城一丁目', areaHa: 20.52, greenSpaceType: 'park', areaM2: 205208, status: 'active',
    openingYear: 'T12', establishedDate: 'T12.10.01', planNumber: '5.5.2', plannedAreaHa: 20.52,
    urbanPlanNumber: '85.5', planDecisionDate: 'T12.06.15', acquisitionMethod: '復買',
    category: '総', schoolDistrict: '丸の内清水山吹', paidFacility: 'テ',
    disasterFacility: '広避 応給・防水 ヘリ', managementOffice: '北土木事務所',
    notes: '北土木管理(52.73ha)観光文化局管理(25.54ha)',
  },
  {
    id: 'GS-zxpnkee2', no: '5.5.3', displayName: '鶴舞公園', ward: '昭和区',
    address: '名古屋市昭和区鶴舞一丁目', areaHa: 23.65, greenSpaceType: 'park', areaM2: 236537, status: 'active',
    openingYear: 'M42', establishedDate: 'M42.11.19', planNumber: '5.5.3', plannedAreaHa: 23.65,
    urbanPlanNumber: '6.27', planDecisionDate: 'M42.08.01', acquisitionMethod: '借復',
    category: '総', schoolDistrict: '東山星ヶ丘見付', paidFacility: 'テ',
    disasterFacility: '広避 応給', managementOffice: '昭和土木事務所',
    notes: '中土木管理(5.94ha)<br>住宅都市局管理(7.77ha)',
  },
  {
    id: 'GS-cfam78i3', no: '5.5.4', displayName: '瑞穂公園', ward: '瑞穂区',
    address: '名古屋市瑞穂区山下通五丁目', areaHa: 23.98, greenSpaceType: 'park', areaM2: 239836, status: 'active',
    openingYear: 'S19', establishedDate: 'S19.04.01', planNumber: '5.5.4', plannedAreaHa: 23.98,
    urbanPlanNumber: '24.46', planDecisionDate: 'S18.12.15', acquisitionMethod: '寄復',
    category: '総', schoolDistrict: '丸の内清水山吹', paidFacility: '競',
    disasterFacility: '防水 ヘリ', managementOffice: '瑞穂土木事務所',
    notes: '北土木管理(52.73ha)<br>観光文化局管理(25.54ha)',
  },
  {
    id: 'GS-9ego0pvp', no: '5.5.5', displayName: '庄内緑地公園', ward: '西区',
    address: '名古屋市西区山田町大字上小田井', areaHa: 42.66, greenSpaceType: 'park', areaM2: 426621, status: 'active',
    openingYear: 'S57', establishedDate: 'S57.04.01', planNumber: '5.5.5', plannedAreaHa: 42.66,
    urbanPlanNumber: '46.03', planDecisionDate: 'S55.03.01', acquisitionMethod: '買借',
    category: '近', schoolDistrict: '西土木事務所', paidFacility: '競',
    disasterFacility: '防水', managementOffice: '西土木事務所',
    notes: '北土木管理(52.73ha)<br>観光文化局管理(25.54ha)',
  },
  {
    id: 'GS-9exy95g1', no: '5.5.6', displayName: '笠寺公園', ward: '南区',
    address: '名古屋市南区見晴町', areaHa: 6.52, greenSpaceType: 'park', areaM2: 65235, status: 'active',
    openingYear: 'S11', establishedDate: 'S11.04.01', planNumber: '5.5.6', plannedAreaHa: 6.52,
    urbanPlanNumber: '4.35', planDecisionDate: 'S10.12.01', acquisitionMethod: '復寄',
    category: '近', schoolDistrict: '南土木事務所', paidFacility: '野',
    disasterFacility: '防水', managementOffice: '南土木事務所',
    notes: '昭和土木管理',
  },
  {
    id: 'GS-rtljov09', no: '5.5.7', displayName: '千種公園', ward: '千種区',
    address: '名古屋市千種区若水一丁目', areaHa: 5.87, greenSpaceType: 'park', areaM2: 58659, status: 'active',
    openingYear: 'S42', establishedDate: 'S42.04.01', planNumber: '5.5.7', plannedAreaHa: 5.87,
    urbanPlanNumber: '5.25', planDecisionDate: 'S40.06.15', acquisitionMethod: '寄借',
    category: '近', schoolDistrict: '千種土木事務所', paidFacility: '野',
    disasterFacility: '防水', managementOffice: '千種土木事務所',
    notes: '中土木管理(5.94ha)<br>住宅都市局管理(7.77ha)',
  },
  {
    id: 'GS-xk4kyf2q', no: '5.5.8', displayName: '志賀公園', ward: '北区',
    address: '名古屋市北区城見通二丁目', areaHa: 5.17, greenSpaceType: 'park', areaM2: 51705, status: 'active',
    openingYear: 'S7', establishedDate: 'S07.04.01', planNumber: '5.5.8', plannedAreaHa: 5.17,
    urbanPlanNumber: '16.31', planDecisionDate: 'S06.10.01', acquisitionMethod: '買復',
    category: '近', schoolDistrict: '北土木事務所', paidFacility: 'テ',
    disasterFacility: '防水', managementOffice: '北土木事務所',
    notes: '北土木管理(52.73ha)<br>観光文化局管理(25.54ha)',
  },
  {
    id: 'GS-es1u7z8r', no: '5.5.9', displayName: '白川公園', ward: '中区',
    address: '名古屋市中区栄二丁目', areaHa: 8.93, greenSpaceType: 'park', areaM2: 89299, status: 'active',
    openingYear: 'S31', establishedDate: 'S31.04.01', planNumber: '5.5.9', plannedAreaHa: 8.93,
    urbanPlanNumber: '5.94', planDecisionDate: 'S30.01.15', acquisitionMethod: '復借',
    category: '近', schoolDistrict: '丸の内清水山吹', paidFacility: 'テ',
    disasterFacility: '防水', managementOffice: '中土木事務所',
    notes: 'ゲートボール場1<br>室内広場1',
  },
  {
    id: 'GS-gul3d3ul', no: '5.5.10', displayName: '熱田神宮公園', ward: '熱田区',
    address: '名古屋市熱田区旗屋一丁目', areaHa: 7.81, greenSpaceType: 'park', areaM2: 78109, status: 'active',
    openingYear: 'S3', establishedDate: 'S03.04.01', planNumber: '5.5.10', plannedAreaHa: 7.81,
    urbanPlanNumber: '24.46', planDecisionDate: 'S02.09.01', acquisitionMethod: '借買',
    category: '近', schoolDistrict: '熱田土木事務所', paidFacility: '野',
    disasterFacility: 'ヘリ', managementOffice: '熱田土木事務所',
    notes: 'ゲートボール場1<br>室内広場1',
  },
  {
    id: 'GS-byrogagk', no: '5.5.11', displayName: '久屋大通公園', ward: '中区',
    address: '名古屋市中区丸の内三丁目', areaHa: 10.57, greenSpaceType: 'park', areaM2: 105736, status: 'active',
    openingYear: 'S30', establishedDate: 'S30.04.01', planNumber: '5.5.11', plannedAreaHa: 10.57,
    urbanPlanNumber: '79.78', planDecisionDate: 'S29.03.01', acquisitionMethod: '寄借',
    category: '街', schoolDistrict: '丸の内清水山吹', paidFacility: 'テ',
    disasterFacility: 'ヘリ', managementOffice: '中土木事務所',
    notes: 'ゲートボール場1<br>室内広場1',
  },
  {
    id: 'GS-gs3xyhbw', no: '5.5.12', displayName: '荒子川公園', ward: '港区',
    address: '名古屋市港区品川町二丁目', areaHa: 23.72, greenSpaceType: 'park', areaM2: 237208, status: 'active',
    openingYear: 'S54', establishedDate: 'S54.04.01', planNumber: '5.5.12', plannedAreaHa: 23.72,
    urbanPlanNumber: '24.46', planDecisionDate: 'S52.06.01', acquisitionMethod: '復買',
    category: '近', schoolDistrict: '港土木事務所', paidFacility: '野',
    disasterFacility: '応給', managementOffice: '港土木事務所',
    notes: '中土木管理(5.94ha)<br>住宅都市局管理(7.77ha)',
  },
  {
    id: 'GS-auy42b1p', no: '5.5.13', displayName: '大高緑地公園', ward: '緑区',
    address: '名古屋市緑区大高町字高山', areaHa: 110.24, greenSpaceType: 'park', areaM2: 1102426, status: 'active',
    openingYear: 'S38', establishedDate: 'S38.04.01', planNumber: '5.5.13', plannedAreaHa: 110.24,
    urbanPlanNumber: '5.25', planDecisionDate: 'S36.10.01', acquisitionMethod: '借復',
    category: '総', schoolDistrict: '緑土木事務所', paidFacility: 'ソ',
    disasterFacility: '応給', managementOffice: '緑土木事務所',
    notes: '中土木管理(5.94ha)<br>住宅都市局管理(7.77ha)',
  },
  {
    id: 'GS-3d67hwf5', no: '5.5.14', displayName: '戸田川緑地', ward: '中川区',
    address: '名古屋市港区春田野二丁目', areaHa: 36.41, greenSpaceType: 'park', areaM2: 364075, status: 'active',
    openingYear: 'H1', establishedDate: 'H01.04.01', planNumber: '5.5.14', plannedAreaHa: 36.41,
    urbanPlanNumber: '24.46', planDecisionDate: 'S63.12.01', acquisitionMethod: '買寄',
    category: '総', schoolDistrict: '中川土木事務所', paidFacility: '動',
    disasterFacility: 'ヘリ', managementOffice: '中川土木事務所',
    notes: '北土木管理(52.73ha)<br>観光文化局管理(25.54ha)',
  },
  {
    id: 'GS-ful7d9lw', no: '5.5.15', displayName: '徳川園', ward: '東区',
    address: '名古屋市東区徳川町', areaHa: 5.50, greenSpaceType: 'garden', areaM2: 55029, status: 'active',
    openingYear: 'S6', establishedDate: 'S06.04.01', planNumber: '5.5.15', plannedAreaHa: 5.50,
    urbanPlanNumber: '7.94', planDecisionDate: 'S05.09.01', acquisitionMethod: '寄復',
    category: '近', schoolDistrict: '東土木事務所', paidFacility: '庭',
    disasterFacility: '応給', managementOffice: '東土木事務所',
    notes: '中土木管理(5.94ha)<br>住宅都市局管理(7.77ha)',
  },
  {
    id: 'GS-7f2voyoy', no: '5.5.16', displayName: '猪高緑地', ward: '名東区',
    address: '名古屋市名東区猪高町大字猪子石', areaHa: 63.13, greenSpaceType: 'park', areaM2: 631296, status: 'active',
    openingYear: 'S51', establishedDate: 'S51.04.01', planNumber: '5.5.16', plannedAreaHa: 63.13,
    urbanPlanNumber: '79.78', planDecisionDate: 'S49.06.01', acquisitionMethod: '買復',
    category: '近', schoolDistrict: '名東土木事務所', paidFacility: '野',
    disasterFacility: '応給', managementOffice: '名東土木事務所',
    notes: 'ゲートボール場1<br>室内広場1',
  },
  {
    id: 'GS-x1q5e2te', no: '5.5.17', displayName: '牧野ヶ池緑地', ward: '名東区',
    address: '名古屋市名東区牧の原三丁目', areaHa: 135.19, greenSpaceType: 'park', areaM2: 1351901, status: 'active',
    openingYear: 'S56', establishedDate: 'S56.04.01', planNumber: '5.5.17', plannedAreaHa: 135.19,
    urbanPlanNumber: '46.03', planDecisionDate: 'S54.03.01', acquisitionMethod: '復寄',
    category: '総', schoolDistrict: '名東土木事務所', paidFacility: '競',
    disasterFacility: '防水', managementOffice: '名東土木事務所',
    notes: '北土木管理(52.73ha)<br>観光文化局管理(25.54ha)',
  },
  {
    id: 'GS-ldnfwyur', no: '5.5.18', displayName: '小幡緑地公園', ward: '守山区',
    address: '名古屋市守山区牛牧中山', areaHa: 13.17, greenSpaceType: 'park', areaM2: 131662, status: 'active',
    openingYear: 'S35', establishedDate: 'S35.04.01', planNumber: '5.5.18', plannedAreaHa: 13.17,
    urbanPlanNumber: '24.46', planDecisionDate: 'S33.10.01', acquisitionMethod: '借寄',
    category: '近', schoolDistrict: '守山土木事務所', paidFacility: 'ソ',
    disasterFacility: '防水', managementOffice: '守山土木事務所',
    notes: '中土木管理(5.94ha)<br>住宅都市局管理(7.77ha)',
  },
] as const;

export const CURATED_PARK_IDS: Set<string> = new Set(CURATED_PARKS.map(p => p.id));
