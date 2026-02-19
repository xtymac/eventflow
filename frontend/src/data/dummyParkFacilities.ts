/**
 * Dummy park facility data for demo purposes.
 * Each facility is a GeoJSON Feature with ParkFacilityAsset properties.
 * Coordinates are generated near each park's center with small offsets.
 */
import type { Feature, Point } from 'geojson';
import type { ParkFacilityAsset, ParkFacilityFilters } from '@nagoya/shared';

type FacilityFeature = Feature<Point, ParkFacilityAsset>;

// Park info: [id, name, ward, center_lng, center_lat]
// Center coordinates from ST_PointOnSurface(geometry) — guaranteed inside each park polygon
const PARKS: Array<[string, string, string, number, number]> = [
  ['GS-zxpnkee2', '鶴舞公園', '昭和区', 136.919915, 35.155046],
  ['GS-nliigh01', '名城公園', '北区', 136.901605, 35.188603],
  ['GS-4g77l6x7', '東山動植物園', '千種区', 136.981820, 35.156527],
  ['GS-es1u7z8r', '白川公園', '中区', 136.899989, 35.164484],
  ['GS-9ego0pvp', '庄内緑地公園', '西区', 136.882604, 35.211721],
  ['GS-auy42b1p', '大高緑地公園', '緑区', 136.954263, 35.064370],
  ['GS-gs3xyhbw', '荒子川公園', '港区', 136.862510, 35.099133],
  ['GS-3d67hwf5', '戸田川緑地', '中川区', 136.811570, 35.116685],
  ['GS-byrogagk', '久屋大通公園', '中区', 136.908829, 35.167366],
  ['GS-ful7d9lw', '徳川園', '東区', 136.932935, 35.184774],
  ['GS-7f2voyoy', '猪高緑地', '名東区', 137.021558, 35.163867],
  ['GS-x1q5e2te', '牧野ヶ池緑地', '名東区', 137.007153, 35.144465],
  ['GS-ldnfwyur', '小幡緑地公園', '守山区', 136.975538, 35.210151],
  ['GS-9exy95g1', '笠寺公園', '南区', 136.940503, 35.099819],
  ['GS-xk4kyf2q', '志賀公園', '北区', 136.904724, 35.202371],
  ['GS-cfam78i3', '瑞穂公園', '瑞穂区', 136.942583, 35.124602],
  ['GS-gul3d3ul', '熱田神宮公園', '熱田区', 136.902459, 35.131117],
  ['GS-rtljov09', '千種公園', '千種区', 136.943482, 35.176277],
];

// Facility definitions per park: [name, category, subCategory, conditionGrade, material]
type FacDef = [string, string, string | null, string, string | null];

const FACILITY_DEFS: Record<string, FacDef[]> = {
  'GS-zxpnkee2': [
    ['複合遊具 01', 'playground', '複合遊具', 'B', '鉄・FRP'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['パーゴラ 01', 'shelter', 'パーゴラ', 'A', '木'],
    ['すべり台 01', 'playground', 'すべり台', 'B', 'ステンレス'],
    ['砂場 01', 'playground', '砂場', 'A', null],
  ],
  'GS-nliigh01': [
    ['複合遊具 01', 'playground', '複合遊具', 'A', '鉄・FRP'],
    ['シェルター 01', 'shelter', 'シェルター', 'B', '鉄'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['鉄棒 01', 'playground', '鉄棒', 'B', '鉄'],
  ],
  'GS-4g77l6x7': [
    ['野外卓 01', 'bench', '野外卓', 'A', '木'],
    ['すべり台 01', 'playground', 'すべり台', 'B', 'ステンレス'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['シェルター 01', 'shelter', 'シェルター', 'A', '鉄'],
    ['舗装 01', 'pavement', '舗装', 'B', 'アスファルト'],
  ],
  'GS-es1u7z8r': [
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['舗装 01', 'pavement', '舗装', 'A', 'インターロッキング'],
    ['パーゴラ 01', 'shelter', 'パーゴラ', 'B', '木'],
  ],
  'GS-9ego0pvp': [
    ['複合遊具 01', 'playground', '複合遊具', 'B', '鉄・FRP'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['健康器具 01', 'playground', '健康器具', 'A', '鉄'],
    ['シェルター 01', 'shelter', 'シェルター', 'B', '鉄'],
  ],
  'GS-auy42b1p': [
    ['すべり台 01', 'playground', 'すべり台', 'C', 'ステンレス'],
    ['ブランコ 01', 'playground', 'ブランコ', 'B', '鉄'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['パーゴラ 01', 'shelter', 'パーゴラ', 'B', '木'],
    ['砂場 01', 'playground', '砂場', 'B', null],
  ],
  'GS-gs3xyhbw': [
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['鉄棒 01', 'playground', '鉄棒', 'B', '鉄'],
    ['シェルター 01', 'shelter', 'シェルター', 'A', '鉄'],
    ['舗装 01', 'pavement', '舗装', 'A', 'アスファルト'],
  ],
  'GS-3d67hwf5': [
    ['複合遊具 01', 'playground', '複合遊具', 'A', '鉄・FRP'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['シーソー 01', 'playground', 'シーソー', 'B', '鉄'],
    ['パーゴラ 01', 'shelter', 'パーゴラ', 'A', '木'],
  ],
  'GS-byrogagk': [
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['舗装 01', 'pavement', '舗装', 'A', 'インターロッキング'],
    ['野外卓 01', 'bench', '野外卓', 'A', '木'],
  ],
  'GS-ful7d9lw': [
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['舗装 01', 'pavement', '舗装', 'A', '石畳'],
    ['パーゴラ 01', 'shelter', 'パーゴラ', 'A', '木'],
  ],
  'GS-7f2voyoy': [
    ['シェルター 01', 'shelter', 'シェルター', 'B', '鉄'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['築山 01', 'playground', '築山', 'A', null],
    ['舗装 01', 'pavement', '舗装', 'B', 'アスファルト'],
  ],
  'GS-x1q5e2te': [
    ['すべり台 01', 'playground', 'すべり台', 'B', 'ステンレス'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['シェルター 01', 'shelter', 'シェルター', 'B', '鉄'],
    ['砂場 01', 'playground', '砂場', 'A', null],
  ],
  'GS-ldnfwyur': [
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['鉄棒 01', 'playground', '鉄棒', 'B', '鉄'],
    ['スプリング遊具 01', 'playground', 'スプリング遊具', 'A', '鉄・FRP'],
  ],
  'GS-9exy95g1': [
    ['複合遊具 01', 'playground', '複合遊具', 'B', '鉄・FRP'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['砂場 01', 'playground', '砂場', 'A', null],
  ],
  'GS-xk4kyf2q': [
    ['すべり台 01', 'playground', 'すべり台', 'B', 'ステンレス'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['ジャングルジム 01', 'playground', 'ジャングルジム', 'C', '鉄'],
  ],
  'GS-cfam78i3': [
    ['健康器具 01', 'playground', '健康器具', 'A', '鉄'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['パーゴラ 01', 'shelter', 'パーゴラ', 'A', '木'],
    ['ラダー 01', 'playground', 'ラダー', 'B', '鉄'],
  ],
  'GS-gul3d3ul': [
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['舗装 01', 'pavement', '舗装', 'A', '石畳'],
    ['シェルター 01', 'shelter', 'シェルター', 'A', '鉄'],
  ],
  'GS-rtljov09': [
    ['複合遊具 01', 'playground', '複合遊具', 'B', '鉄・FRP'],
    ['ベンチ 01', 'bench', null, 'A', '木'],
    ['シーソー 01', 'playground', 'シーソー', 'B', '鉄'],
  ],
};

// Deterministic offsets for facility points (in degrees, ~30-80m spread)
// Using a simple seeded pattern to avoid Math.random
const OFFSETS: Array<[number, number]> = [
  [0.0003, 0.0002], [-0.0004, 0.0003], [0.0002, -0.0004],
  [-0.0003, -0.0002], [0.0005, 0.0001], [-0.0001, 0.0005],
  [0.0004, -0.0003], [-0.0005, 0.0004],
];

// Deterministic inspection dates and install years
const INSPECTION_DATES = [
  '2024-11-15', '2024-08-20', '2024-06-10', '2025-01-08',
  '2024-09-25', '2024-12-03', '2024-07-18', '2025-02-01',
];
const INSTALL_YEARS = [2005, 2008, 2012, 2015, 2018, 2010, 2003, 2020];
const DESIGN_LIVES = [15, 20, 25, 30];
const STATUSES: Array<ParkFacilityAsset['status']> = [
  'active', 'underRepair', 'suspended', 'active', 'active', 'underRepair', 'active', 'suspended',
];

function buildFeatures(): FacilityFeature[] {
  const features: FacilityFeature[] = [];
  let counter = 1;

  for (const [parkId, parkName, ward, centerLng, centerLat] of PARKS) {
    const defs = FACILITY_DEFS[parkId];
    if (!defs) continue;

    for (let i = 0; i < defs.length; i++) {
      const [facName, category, subCategory, conditionGrade, material] = defs[i];
      const offset = OFFSETS[i % OFFSETS.length];
      const id = `PF-demo-${String(counter).padStart(3, '0')}`;
      const facilityId = `FAC-${String(counter).padStart(4, '0')}`;
      const inspDate = INSPECTION_DATES[counter % INSPECTION_DATES.length];
      const installYear = INSTALL_YEARS[counter % INSTALL_YEARS.length];
      const designLife = DESIGN_LIVES[counter % DESIGN_LIVES.length];

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [centerLng + offset[0], centerLat + offset[1]],
        },
        properties: {
          id,
          facilityId,
          name: `${parkName} ${facName}`,
          description: subCategory ? `${subCategory}（${parkName}内）` : undefined,
          category: category as ParkFacilityAsset['category'],
          subCategory: subCategory ?? undefined,
          dateInstalled: `${installYear}-04-01T00:00:00Z`,
          manufacturer: undefined,
          material: material ?? undefined,
          quantity: 1,
          designLife,
          conditionGrade: conditionGrade as ParkFacilityAsset['conditionGrade'],
          lastInspectionDate: `${inspDate}T00:00:00Z`,
          nextInspectionDate: undefined,
          safetyConcern: conditionGrade === 'C' ? true : false,
          geometry: {
            type: 'Point',
            coordinates: [centerLng + offset[0], centerLat + offset[1]],
          },
          status: STATUSES[i % STATUSES.length],
          condition: conditionGrade === 'A' ? 'good' : conditionGrade === 'B' ? 'attention' : 'bad',
          riskLevel: conditionGrade === 'C' ? 'high' : conditionGrade === 'B' ? 'medium' : 'low',
          ward,
          managingDept: '緑政土木局',
          greenSpaceRef: parkId,
          dataSource: 'manual',
          sourceVersion: undefined,
          sourceDate: undefined,
          lastVerifiedAt: undefined,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
        },
      });
      counter++;
    }
  }

  return features;
}

export const DUMMY_PARK_FACILITIES: FacilityFeature[] = buildFeatures();

/**
 * Filter dummy facilities by the same params the API supports.
 */
export function getDummyParkFacilities(filters?: Partial<ParkFacilityFilters>): FacilityFeature[] {
  let result = DUMMY_PARK_FACILITIES;

  if (filters?.greenSpaceRef) {
    result = result.filter((f) => f.properties.greenSpaceRef === filters.greenSpaceRef);
  }
  if (filters?.category) {
    const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
    result = result.filter((f) => cats.includes(f.properties.category));
  }
  if (filters?.ward) {
    result = result.filter((f) => f.properties.ward === filters.ward);
  }
  if (filters?.conditionGrade) {
    const grades = Array.isArray(filters.conditionGrade) ? filters.conditionGrade : [filters.conditionGrade];
    result = result.filter((f) => f.properties.conditionGrade && grades.includes(f.properties.conditionGrade));
  }
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    result = result.filter((f) =>
      f.properties.name.toLowerCase().includes(q) ||
      f.properties.id.toLowerCase().includes(q) ||
      (f.properties.facilityId?.toLowerCase().includes(q)) ||
      (f.properties.description?.toLowerCase().includes(q))
    );
  }

  return result;
}
