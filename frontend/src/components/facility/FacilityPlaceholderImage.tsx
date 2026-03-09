/** Map of category key → image filenames in /facilities/ */
export const CATEGORY_IMAGES: Record<string, string[]> = {
  // playEquipment 遊戯施設
  swing: ['swing_001.png', 'swing_002.png'],
  slide: ['slide_001.png', 'slide_002.png'],
  climbingGym: ['climbingGym_001.png', 'climbingGym_002.png'],
  sandbox: ['sandbox_001.png', 'sandbox_002.png'],
  combinedPlay: ['combinedPlay_001.png', 'combinedPlay_002.png'],
  healthExercise: ['healthExercise_001.png', 'healthExercise_002.png'],
  // sportsFacility 運動施設
  baseballField: ['baseballField_001.png', 'baseballField_002.png'],
  tennisCourt: ['tennisCourt_001.png', 'tennisCourt_002.png'],
  soccerField: ['soccerField_001.png', 'soccerField_002.png'],
  pool: ['pool_001.png', 'pool_002.png'],
  gateballField: ['gateballField_001.png', 'gateballField_002.png'],
  // pathPlaza 園路広場
  plaza: ['plaza_001.png', 'plaza_002.png'],
  pavement: ['pavement_001.png', 'pavement_002.png'],
  gardenPath: ['gardenPath_001.png', 'gardenPath_002.png'],
  bridge: ['bridge_001.png', 'bridge_002.png'],
  // restFacility 休養施設
  pergola: ['pergola_001.png', 'pergola_002.png'],
  gazebo: ['gazebo_001.png', 'gazebo_002.png'],
  bench: ['bench_001.png', 'bench_002.png'],
  picnicTable: ['picnicTable_001.png', 'picnicTable_002.png'],
  // landscape 修景施設
  fountain: ['fountain_001.png', 'fountain_002.png'],
  pond: ['pond_001.png', 'pond_002.png'],
  monument: ['monument_001.png', 'monument_002.png'],
  flowerBed: ['flowerBed_001.png', 'flowerBed_002.png'],
  // convenience 便益施設
  toilet: ['toilet_001.png', 'toilet_002.png', 'toilet_003.png', 'toilet_004.png', 'toilet_005.png', 'toilet_006.png'],
  waterFountain: ['waterFountain_001.png', 'waterFountain_002.png'],
  clock: ['clock_001.png', 'clock_002.png'],
  parking: ['parking_001.png', 'parking_002.png'],
  // management 管理施設
  warehouse: ['warehouse_001.png', 'warehouse_002.png'],
  bulletinBoard: ['bulletinBoard_001.png', 'bulletinBoard_002.png'],
  bollard: ['bollard_001.png', 'bollard_002.png'],
  parkLight: ['parkLight_001.png', 'parkLight_002.png'],
  fence: ['fence_001.png', 'fence_002.png'],
  // education 教養施設
  ecoPark: ['ecoPark_001.png', 'ecoPark_002.png'],
  birdObservatory: ['birdObservatory_001.png', 'birdObservatory_002.png'],
  teaRoom: ['teaRoom_001.png', 'teaRoom_002.png'],
  // disasterRelief 災害応急対策施設
  disasterWarehouse: ['disasterWarehouse_001.png', 'disasterWarehouse_002.png'],
  fireBrigade: ['fireBrigade_001.png', 'fireBrigade_002.png'],
  // other その他
  other: ['other_001.png', 'other_002.png'],
};

export function FacilityPlaceholderImage({ category, size = 56 }: { category?: string; size?: number }) {
  const images = category ? CATEGORY_IMAGES[category] : undefined;
  const imageFile = images?.[0];

  if (imageFile) {
    return (
      <img
        src={`/facilities/${imageFile}`}
        alt={category}
        className="shrink-0 rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallback SVG for unknown categories
  const iconSize = Math.round(size * 0.5);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md bg-[#F5F5F5]"
      style={{ width: size, height: size }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7" r="7" fill="white" />
        <circle cx="7" cy="7" r="4.667" fill="#3B82F6" />
      </svg>
    </div>
  );
}
