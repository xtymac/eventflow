import {
  Stack,
  Group,
  Text,
  Badge,
  Divider,
  Loader,
  Center,
  Button,
} from '@mantine/core';
import { IconCalendarPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useStreetTree, useParkFacility, usePavementSection, usePumpStation, useGreenSpace } from '../../hooks/useApi';
import { useUIStore, type AssetType } from '../../stores/uiStore';
import type { AssetTypeRef } from '@nagoya/shared';
import type {
  StreetTreeAsset,
  ParkFacilityAsset,
  PavementSectionAsset,
  PumpStationAsset,
  GreenSpaceAsset,
} from '@nagoya/shared';

// --- Badge / label mapping tables ---

const TYPE_CONFIG: Record<AssetType, { label: string; color: string }> = {
  'street-tree': { label: '街路樹', color: 'green' },
  'park-facility': { label: '公園施設', color: 'violet' },
  'pavement-section': { label: '道路舗装', color: 'orange' },
  'pump-station': { label: 'ポンプ施設', color: 'blue' },
  'green-space': { label: '緑地・公園', color: 'teal' },
};

const TREE_CATEGORY_LABELS: Record<string, string> = {
  deciduous: '落葉樹', evergreen: '常緑樹', conifer: '針葉樹', palmLike: 'ヤシ類', shrub: '低木',
};

const FACILITY_CATEGORY_LABELS: Record<string, string> = {
  toilet: 'トイレ', playground: '遊具', bench: 'ベンチ', shelter: '東屋',
  fence: 'フェンス', gate: '門', drainage: '排水', lighting: '照明',
  waterFountain: '水飲み場', signBoard: '案内板', pavement: '舗装',
  sportsFacility: '運動施設', building: '建屋', other: 'その他',
};

const PAVEMENT_TYPE_LABELS: Record<string, string> = {
  asphalt: 'アスファルト', concrete: 'コンクリート', interlocking: 'インターロッキング',
  gravel: '砂利', other: 'その他',
};

const PUMP_CATEGORY_LABELS: Record<string, string> = {
  stormwater: '雨水', sewage: '汚水', irrigation: '灌漑', combined: '合流',
};

const GREEN_SPACE_TYPE_LABELS: Record<string, string> = {
  park: '公園', garden: '庭園', forest: '森林', wetland: '湿地',
  grassland: '草地', nature_reserve: '自然保護区', other: 'その他',
};

const VEGETATION_TYPE_LABELS: Record<string, string> = {
  deciduous: '落葉', evergreen: '常緑', mixed: '混合', none: 'なし',
};

// --- Governance-level state dimension configs ---

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: '\u26A1 稼働中', color: 'green' },
  inactive: { label: '\u23F8\uFE0F 休止中', color: 'gray' },
  removed: { label: '\u{1F6AB} 撤去済', color: 'red' },
};

const CONDITION_CONFIG: Record<string, { label: string; color: string }> = {
  good: { label: '\u2705 良好', color: 'green' },
  attention: { label: '\u26A0\uFE0F 要注意', color: 'yellow' },
  bad: { label: '\u274C 不良', color: 'red' },
  unknown: { label: '\u2753 不明', color: 'gray' },
};

const RISK_LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: '\u{1F7E2} 低リスク', color: 'green' },
  medium: { label: '\u{1F7E1} 中リスク', color: 'yellow' },
  high: { label: '\u{1F534} 高リスク', color: 'red' },
};

// Emoji maps (matching AssetList)
const TREE_EMOJI: Record<string, string> = {
  deciduous: '\u{1F333}', evergreen: '\u{1F332}', conifer: '\u{1F332}',
  palmLike: '\u{1F334}', shrub: '\u{1F33F}',
};

const FACILITY_EMOJI: Record<string, string> = {
  toilet: '\u{1F6BB}', playground: '\u{1F6DD}', bench: '\u{1FA91}', shelter: '\u26E9\uFE0F',
  fence: '\u{1F6A7}', gate: '\u{1F6AA}', drainage: '\u{1F30A}', lighting: '\u{1F4A1}',
  waterFountain: '\u26F2', signBoard: '\u{1FAA7}', pavement: '\u2B1C',
  sportsFacility: '\u26BD', building: '\u{1F3E2}', other: '\u{1F4E6}',
};

const PUMP_EMOJI: Record<string, string> = {
  stormwater: '\u{1F4A7}', sewage: '\u{1F7E3}', irrigation: '\u{1F33E}', combined: '\u{1F504}',
};

// --- InfoRow helper ---

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>{label}</Text>
      <Text size="sm" ta="right" style={{ wordBreak: 'break-word' }}>{value}</Text>
    </Group>
  );
}

function formatDate(date?: string | null): string | undefined {
  if (!date) return undefined;
  return dayjs(date).format('YYYY/MM/DD');
}

function formatCurrency(amount?: number | null): string | undefined {
  if (amount == null) return undefined;
  return `\xA5${amount.toLocaleString()}`;
}

// --- Governance-level Current State header ---

function CurrentStateHeader({ status, condition, riskLevel }: {
  status?: string;
  condition?: string | null;
  riskLevel?: string | null;
}) {
  const hasAny = status || condition || riskLevel;
  if (!hasAny) return null;
  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">現在の状態</Text>
      <Group gap="xs">
        {status && (
          <Badge color={STATUS_CONFIG[status]?.color ?? 'gray'} variant="filled" size="sm">
            {STATUS_CONFIG[status]?.label ?? status}
          </Badge>
        )}
        {condition && (
          <Badge color={CONDITION_CONFIG[condition]?.color ?? 'gray'} variant="light" size="sm">
            {CONDITION_CONFIG[condition]?.label ?? condition}
          </Badge>
        )}
        {riskLevel && (
          <Badge color={RISK_LEVEL_CONFIG[riskLevel]?.color ?? 'gray'} variant="outline" size="sm">
            {RISK_LEVEL_CONFIG[riskLevel]?.label ?? riskLevel}
          </Badge>
        )}
      </Group>
    </Stack>
  );
}

// --- Sub-panels for each asset type ---

function StreetTreeDetail({ asset }: { asset: StreetTreeAsset }) {
  const emoji = TREE_EMOJI[asset.category] || '\u{1F333}';
  const resolvedName = asset.displayName || asset.speciesName || asset.ledgerId || '街路樹';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge color={TYPE_CONFIG['street-tree'].color}>{TYPE_CONFIG['street-tree'].label}</Badge>
      </Group>
      <Text fw={700} size="lg">{emoji} {resolvedName}</Text>
      {asset.ward && <Text size="sm" c="dimmed">{asset.ward}</Text>}

      <CurrentStateHeader status={asset.status} condition={asset.condition} riskLevel={asset.riskLevel} />

      <Divider />

      <InfoRow label="樹種" value={asset.speciesName} />
      <InfoRow label="学名" value={asset.scientificName} />
      <InfoRow label="種別" value={TREE_CATEGORY_LABELS[asset.category] || asset.category} />
      <InfoRow label="胸高直径" value={asset.trunkDiameter != null ? `${asset.trunkDiameter} cm` : undefined} />
      <InfoRow label="樹高" value={asset.height != null ? `${asset.height} m` : undefined} />
      <InfoRow label="枝張り" value={asset.crownSpread != null ? `${asset.crownSpread} m` : undefined} />
      <InfoRow label="植栽日" value={formatDate(asset.datePlanted)} />
      <InfoRow label="推定樹齢" value={asset.estimatedAge != null ? `${asset.estimatedAge} 年` : undefined} />
      <InfoRow label="最終診断日" value={formatDate(asset.lastDiagnosticDate)} />
      <InfoRow label="管理部署" value={asset.managingDept} />

      <Divider />

      <Text size="xs" c="dimmed">登録: {dayjs(asset.createdAt).format('YYYY/MM/DD')}</Text>
      <Text size="xs" c="dimmed">更新: {dayjs(asset.updatedAt).format('YYYY/MM/DD')}</Text>
    </Stack>
  );
}

function ParkFacilityDetail({ asset }: { asset: ParkFacilityAsset }) {
  const emoji = FACILITY_EMOJI[asset.category] || '\u{1F4E6}';
  const resolvedName = asset.name || asset.facilityId || '施設';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge color={TYPE_CONFIG['park-facility'].color}>{TYPE_CONFIG['park-facility'].label}</Badge>
      </Group>
      <Text fw={700} size="lg">{emoji} {resolvedName}</Text>
      {asset.ward && <Text size="sm" c="dimmed">{asset.ward}</Text>}

      <CurrentStateHeader status={asset.status} condition={asset.condition} riskLevel={asset.riskLevel} />

      <Divider />

      <InfoRow label="施設種別" value={FACILITY_CATEGORY_LABELS[asset.category] || asset.category} />
      <InfoRow label="細分類" value={asset.subCategory} />
      <InfoRow label="説明" value={asset.description} />
      <InfoRow label="設置日" value={formatDate(asset.dateInstalled)} />
      <InfoRow label="設計供用年数" value={asset.designLife != null ? `${asset.designLife} 年` : undefined} />
      <InfoRow label="メーカー" value={asset.manufacturer} />
      <InfoRow label="素材" value={asset.material} />
      <InfoRow label="数量" value={asset.quantity != null ? String(asset.quantity) : undefined} />
      <InfoRow label="最終点検日" value={formatDate(asset.lastInspectionDate)} />
      <InfoRow label="次回点検日" value={formatDate(asset.nextInspectionDate)} />
      <InfoRow label="管理部署" value={asset.managingDept} />

      <Divider />

      <Text size="xs" c="dimmed">登録: {dayjs(asset.createdAt).format('YYYY/MM/DD')}</Text>
      <Text size="xs" c="dimmed">更新: {dayjs(asset.updatedAt).format('YYYY/MM/DD')}</Text>
    </Stack>
  );
}

function PavementSectionDetail({ asset }: { asset: PavementSectionAsset }) {
  const resolvedName = asset.name || asset.sectionId || asset.routeNumber || '舗装区間';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge color={TYPE_CONFIG['pavement-section'].color}>{TYPE_CONFIG['pavement-section'].label}</Badge>
        {asset.mci != null && (
          <Badge variant="outline" size="sm" color={asset.mci >= 7 ? 'green' : asset.mci >= 4 ? 'yellow' : 'red'}>
            MCI {asset.mci.toFixed(1)}
          </Badge>
        )}
      </Group>
      <Text fw={700} size="lg">{'\u{1F6E3}\uFE0F'} {resolvedName}</Text>
      {asset.ward && <Text size="sm" c="dimmed">{asset.ward}</Text>}

      <CurrentStateHeader status={asset.status} condition={asset.condition} riskLevel={asset.riskLevel} />

      <Divider />

      <InfoRow label="路線番号" value={asset.routeNumber} />
      <InfoRow label="舗装種別" value={PAVEMENT_TYPE_LABELS[asset.pavementType] || asset.pavementType} />
      <InfoRow label="延長" value={asset.length != null ? `${asset.length} m` : undefined} />
      <InfoRow label="幅員" value={asset.width != null ? `${asset.width} m` : undefined} />
      <InfoRow label="厚さ" value={asset.thickness != null ? `${asset.thickness} cm` : undefined} />

      <Divider label="路面性状値" labelPosition="left" />

      <InfoRow label="MCI" value={asset.mci != null ? asset.mci.toFixed(1) : undefined} />
      <InfoRow label="ひび割れ率" value={asset.crackRate != null ? `${asset.crackRate}%` : undefined} />
      <InfoRow label="わだち掘れ" value={asset.rutDepth != null ? `${asset.rutDepth} mm` : undefined} />
      <InfoRow label="IRI" value={asset.iri != null ? `${asset.iri} m/km` : undefined} />
      <InfoRow label="最終測定日" value={formatDate(asset.lastMeasurementDate)} />

      <Divider label="補修計画" labelPosition="left" />

      <InfoRow label="最終補修日" value={formatDate(asset.lastResurfacingDate)} />
      <InfoRow label="計画補修年度" value={asset.plannedInterventionYear != null ? String(asset.plannedInterventionYear) : undefined} />
      <InfoRow label="概算費用" value={formatCurrency(asset.estimatedCost)} />
      <InfoRow label="優先順位" value={asset.priorityRank != null ? `#${asset.priorityRank}` : undefined} />
      <InfoRow label="管理部署" value={asset.managingDept} />

      <Divider />

      <Text size="xs" c="dimmed">登録: {dayjs(asset.createdAt).format('YYYY/MM/DD')}</Text>
      <Text size="xs" c="dimmed">更新: {dayjs(asset.updatedAt).format('YYYY/MM/DD')}</Text>
    </Stack>
  );
}

function PumpStationDetail({ asset }: { asset: PumpStationAsset }) {
  const emoji = PUMP_EMOJI[asset.category] || '\u{1F4A7}';
  const resolvedName = asset.name || asset.stationId || 'ポンプ施設';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge color={TYPE_CONFIG['pump-station'].color}>{TYPE_CONFIG['pump-station'].label}</Badge>
      </Group>
      <Text fw={700} size="lg">{emoji} {resolvedName}</Text>
      {asset.ward && <Text size="sm" c="dimmed">{asset.ward}</Text>}

      <CurrentStateHeader status={asset.status} condition={asset.condition} riskLevel={asset.riskLevel} />

      <Divider />

      <InfoRow label="種別" value={PUMP_CATEGORY_LABELS[asset.category] || asset.category} />
      <InfoRow label="説明" value={asset.description} />
      <InfoRow label="供用開始日" value={formatDate(asset.dateCommissioned)} />
      <InfoRow label="設計能力" value={asset.designCapacity != null ? `${asset.designCapacity} m\u00B3/min` : undefined} />
      <InfoRow label="ポンプ台数" value={asset.pumpCount != null ? `${asset.pumpCount} 台` : undefined} />
      <InfoRow label="総出力" value={asset.totalPower != null ? `${asset.totalPower} kW` : undefined} />
      <InfoRow label="排水面積" value={asset.drainageArea != null ? `${asset.drainageArea} ha` : undefined} />
      <InfoRow label="最終保守日" value={formatDate(asset.lastMaintenanceDate)} />
      <InfoRow label="次回保守日" value={formatDate(asset.nextMaintenanceDate)} />
      <InfoRow label="管理事務所" value={asset.managingOffice} />
      <InfoRow label="管理部署" value={asset.managingDept} />

      <Divider />

      <Text size="xs" c="dimmed">登録: {dayjs(asset.createdAt).format('YYYY/MM/DD')}</Text>
      <Text size="xs" c="dimmed">更新: {dayjs(asset.updatedAt).format('YYYY/MM/DD')}</Text>
    </Stack>
  );
}

function GreenSpaceDetail({ asset }: { asset: GreenSpaceAsset }) {
  const resolvedName = asset.displayName || asset.nameJa || asset.name || '緑地';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge color={TYPE_CONFIG['green-space'].color}>{TYPE_CONFIG['green-space'].label}</Badge>
      </Group>
      <Text fw={700} size="lg">{'\u{1F3DE}\uFE0F'} {resolvedName}</Text>
      {asset.ward && <Text size="sm" c="dimmed">{asset.ward}</Text>}

      <CurrentStateHeader status={asset.status} condition={asset.condition} riskLevel={asset.riskLevel} />

      <Divider />

      <InfoRow label="種別" value={GREEN_SPACE_TYPE_LABELS[asset.greenSpaceType] || asset.greenSpaceType} />
      {asset.leisureType && <InfoRow label="余暇タイプ" value={asset.leisureType} />}
      {asset.landuseType && <InfoRow label="土地利用" value={asset.landuseType} />}
      {asset.naturalType && <InfoRow label="自然タイプ" value={asset.naturalType} />}
      <InfoRow label="面積" value={asset.areaM2 != null ? `${(asset.areaM2 / 10000).toFixed(2)} ha` : undefined} />
      <InfoRow label="植生" value={asset.vegetationType ? (VEGETATION_TYPE_LABELS[asset.vegetationType] || asset.vegetationType) : undefined} />
      <InfoRow label="運営者" value={asset.operator} />

      <Divider />

      <Text size="xs" c="dimmed">更新: {dayjs(asset.updatedAt).format('YYYY/MM/DD')}</Text>
    </Stack>
  );
}

// --- AssetType to AssetTypeRef mapping ---

const ASSET_TYPE_TO_REF: Record<AssetType, AssetTypeRef> = {
  'street-tree': 'street_tree',
  'park-facility': 'park_facility',
  'pavement-section': 'pavement_section',
  'pump-station': 'pump_station',
  'green-space': 'greenspace',
};

// --- Main component ---

interface AssetDetailPanelProps {
  assetId: string;
  assetType: AssetType;
}

export function AssetDetailPanel({ assetId, assetType }: AssetDetailPanelProps) {
  const { setEventFormPrefill, openEventForm } = useUIStore();

  // Call all hooks unconditionally (React rules of hooks), but only enable the matching one
  const streetTree = useStreetTree(assetType === 'street-tree' ? assetId : null);
  const parkFacility = useParkFacility(assetType === 'park-facility' ? assetId : null);
  const pavementSection = usePavementSection(assetType === 'pavement-section' ? assetId : null);
  const pumpStation = usePumpStation(assetType === 'pump-station' ? assetId : null);
  const greenSpace = useGreenSpace(assetType === 'green-space' ? assetId : null);

  // Determine which query is active
  const activeQuery =
    assetType === 'street-tree' ? streetTree :
    assetType === 'park-facility' ? parkFacility :
    assetType === 'pavement-section' ? pavementSection :
    assetType === 'green-space' ? greenSpace :
    pumpStation;

  if (activeQuery.isLoading) {
    return (
      <Center py="md">
        <Loader size="sm" />
      </Center>
    );
  }

  if (activeQuery.error || !activeQuery.data) {
    return (
      <Center py="md">
        <Text c="red" size="sm">Failed to load asset details</Text>
      </Center>
    );
  }

  const feature = activeQuery.data;
  const props = feature.properties;

  // Render the appropriate detail component based on asset type
  const renderDetail = () => {
    switch (assetType) {
      case 'street-tree':
        return <StreetTreeDetail asset={props as StreetTreeAsset} />;
      case 'park-facility':
        return <ParkFacilityDetail asset={props as ParkFacilityAsset} />;
      case 'pavement-section':
        return <PavementSectionDetail asset={props as PavementSectionAsset} />;
      case 'pump-station':
        return <PumpStationDetail asset={props as PumpStationAsset} />;
      case 'green-space':
        return <GreenSpaceDetail asset={props as GreenSpaceAsset} />;
      default:
        return null;
    }
  };

  const handleCreateEvent = () => {
    const refAssetType = ASSET_TYPE_TO_REF[assetType];
    setEventFormPrefill({ refAssetId: assetId, refAssetType });
    openEventForm();
  };

  return (
    <Stack gap="md">
      {renderDetail()}
      <Divider />
      <Button
        variant="light"
        color="blue"
        leftSection={<IconCalendarPlus size={16} />}
        onClick={handleCreateEvent}
        fullWidth
      >
        新規イベント作成
      </Button>
    </Stack>
  );
}
