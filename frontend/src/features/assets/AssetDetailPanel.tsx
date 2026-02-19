import { Stack, Group, Text, Divider, Center, Loader } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const TYPE_CONFIG: Record<AssetType, { label: string; className: string }> = {
  'street-tree': { label: '\u8857\u8DEF\u6A39', className: 'bg-green-100 text-green-800' },
  'park-facility': { label: '\u516C\u5712\u65BD\u8A2D', className: 'bg-violet-100 text-violet-800' },
  'pavement-section': { label: '\u9053\u8DEF\u8217\u88C5', className: 'bg-orange-100 text-orange-800' },
  'pump-station': { label: '\u30DD\u30F3\u30D7\u65BD\u8A2D', className: 'bg-blue-100 text-blue-800' },
  'green-space': { label: '\u7DD1\u5730\u30FB\u516C\u5712', className: 'bg-teal-100 text-teal-800' },
};

const TREE_CATEGORY_LABELS: Record<string, string> = {
  deciduous: '\u843D\u8449\u6A39', evergreen: '\u5E38\u7DD1\u6A39', conifer: '\u91DD\u8449\u6A39', palmLike: '\u30E4\u30B7\u985E', shrub: '\u4F4E\u6728',
};

const FACILITY_CATEGORY_LABELS: Record<string, string> = {
  toilet: '\u30C8\u30A4\u30EC', playground: '\u904A\u5177', bench: '\u30D9\u30F3\u30C1', shelter: '\u6771\u5C4B',
  fence: '\u30D5\u30A7\u30F3\u30B9', gate: '\u9580', drainage: '\u6392\u6C34', lighting: '\u7167\u660E',
  waterFountain: '\u6C34\u98F2\u307F\u5834', signBoard: '\u6848\u5185\u677F', pavement: '\u8217\u88C5',
  sportsFacility: '\u904B\u52D5\u65BD\u8A2D', building: '\u5EFA\u5C4B', other: '\u305D\u306E\u4ED6',
};

const PAVEMENT_TYPE_LABELS: Record<string, string> = {
  asphalt: '\u30A2\u30B9\u30D5\u30A1\u30EB\u30C8', concrete: '\u30B3\u30F3\u30AF\u30EA\u30FC\u30C8', interlocking: '\u30A4\u30F3\u30BF\u30FC\u30ED\u30C3\u30AD\u30F3\u30B0',
  gravel: '\u7802\u5229', other: '\u305D\u306E\u4ED6',
};

const PUMP_CATEGORY_LABELS: Record<string, string> = {
  stormwater: '\u96E8\u6C34', sewage: '\u6C5A\u6C34', irrigation: '\u704C\u6F51', combined: '\u5408\u6D41',
};

const GREEN_SPACE_TYPE_LABELS: Record<string, string> = {
  park: '\u516C\u5712', garden: '\u5EAD\u5712', forest: '\u68EE\u6797', wetland: '\u6E7F\u5730',
  grassland: '\u8349\u5730', nature_reserve: '\u81EA\u7136\u4FDD\u8B77\u533A', other: '\u305D\u306E\u4ED6',
};

const VEGETATION_TYPE_LABELS: Record<string, string> = {
  deciduous: '\u843D\u8449', evergreen: '\u5E38\u7DD1', mixed: '\u6DF7\u5408', none: '\u306A\u3057',
};

// --- Governance-level state dimension configs ---

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: '\u26A1 \u7A3C\u50CD\u4E2D', className: 'bg-green-600 text-white' },
  inactive: { label: '\u23F8\uFE0F \u4F11\u6B62\u4E2D', className: 'bg-gray-500 text-white' },
  removed: { label: '\u{1F6AB} \u64A4\u53BB\u6E08', className: 'bg-red-600 text-white' },
};

const CONDITION_CONFIG: Record<string, { label: string; className: string }> = {
  good: { label: '\u2705 \u826F\u597D', className: 'bg-green-100 text-green-800' },
  attention: { label: '\u26A0\uFE0F \u8981\u6CE8\u610F', className: 'bg-yellow-100 text-yellow-800' },
  bad: { label: '\u274C \u4E0D\u826F', className: 'bg-red-100 text-red-800' },
  unknown: { label: '\u2753 \u4E0D\u660E', className: 'bg-gray-100 text-gray-800' },
};

const RISK_LEVEL_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: '\u{1F7E2} \u4F4E\u30EA\u30B9\u30AF', className: 'border-green-500 text-green-700' },
  medium: { label: '\u{1F7E1} \u4E2D\u30EA\u30B9\u30AF', className: 'border-yellow-500 text-yellow-700' },
  high: { label: '\u{1F534} \u9AD8\u30EA\u30B9\u30AF', className: 'border-red-500 text-red-700' },
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
    <Group justify="space-between" className="flex-nowrap" gap="xs">
      <Text size="sm" c="dimmed" className="shrink-0">{label}</Text>
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
      <Text size="xs" fw={600} c="dimmed" className="uppercase">現在の状態</Text>
      <Group gap="xs">
        {status && (
          <Badge className={`${STATUS_CONFIG[status]?.className ?? 'bg-gray-500 text-white'}`}>
            {STATUS_CONFIG[status]?.label ?? status}
          </Badge>
        )}
        {condition && (
          <Badge variant="secondary" className={`${CONDITION_CONFIG[condition]?.className ?? 'bg-gray-100 text-gray-800'}`}>
            {CONDITION_CONFIG[condition]?.label ?? condition}
          </Badge>
        )}
        {riskLevel && (
          <Badge variant="outline" className={`${RISK_LEVEL_CONFIG[riskLevel]?.className ?? 'border-gray-500 text-gray-700'}`}>
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
  const resolvedName = asset.displayName || asset.speciesName || asset.ledgerId || '\u8857\u8DEF\u6A39';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge variant="secondary" className={TYPE_CONFIG['street-tree'].className}>{TYPE_CONFIG['street-tree'].label}</Badge>
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
      <InfoRow label="推定樹齢" value={asset.estimatedAge != null ? `${asset.estimatedAge} \u5E74` : undefined} />
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
  const resolvedName = asset.name || asset.facilityId || '\u65BD\u8A2D';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge variant="secondary" className={TYPE_CONFIG['park-facility'].className}>{TYPE_CONFIG['park-facility'].label}</Badge>
      </Group>
      <Text fw={700} size="lg">{emoji} {resolvedName}</Text>
      {asset.ward && <Text size="sm" c="dimmed">{asset.ward}</Text>}

      <CurrentStateHeader status={asset.status} condition={asset.condition} riskLevel={asset.riskLevel} />

      <Divider />

      <InfoRow label="施設種別" value={FACILITY_CATEGORY_LABELS[asset.category] || asset.category} />
      <InfoRow label="細分類" value={asset.subCategory} />
      <InfoRow label="説明" value={asset.description} />
      <InfoRow label="設置日" value={formatDate(asset.dateInstalled)} />
      <InfoRow label="設計供用年数" value={asset.designLife != null ? `${asset.designLife} \u5E74` : undefined} />
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
  const resolvedName = asset.name || asset.sectionId || asset.routeNumber || '\u8217\u88C5\u533A\u9593';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge variant="secondary" className={TYPE_CONFIG['pavement-section'].className}>{TYPE_CONFIG['pavement-section'].label}</Badge>
        {asset.mci != null && (
          <Badge variant="outline" className={`${asset.mci >= 7 ? 'border-green-500 text-green-700' : asset.mci >= 4 ? 'border-yellow-500 text-yellow-700' : 'border-red-500 text-red-700'}`}>
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

      <Divider label="路面性状値" />

      <InfoRow label="MCI" value={asset.mci != null ? asset.mci.toFixed(1) : undefined} />
      <InfoRow label="ひび割れ率" value={asset.crackRate != null ? `${asset.crackRate}%` : undefined} />
      <InfoRow label="わだち掘れ" value={asset.rutDepth != null ? `${asset.rutDepth} mm` : undefined} />
      <InfoRow label="IRI" value={asset.iri != null ? `${asset.iri} m/km` : undefined} />
      <InfoRow label="最終測定日" value={formatDate(asset.lastMeasurementDate)} />

      <Divider label="補修計画" />

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
  const resolvedName = asset.name || asset.stationId || '\u30DD\u30F3\u30D7\u65BD\u8A2D';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge variant="secondary" className={TYPE_CONFIG['pump-station'].className}>{TYPE_CONFIG['pump-station'].label}</Badge>
      </Group>
      <Text fw={700} size="lg">{emoji} {resolvedName}</Text>
      {asset.ward && <Text size="sm" c="dimmed">{asset.ward}</Text>}

      <CurrentStateHeader status={asset.status} condition={asset.condition} riskLevel={asset.riskLevel} />

      <Divider />

      <InfoRow label="種別" value={PUMP_CATEGORY_LABELS[asset.category] || asset.category} />
      <InfoRow label="説明" value={asset.description} />
      <InfoRow label="供用開始日" value={formatDate(asset.dateCommissioned)} />
      <InfoRow label="設計能力" value={asset.designCapacity != null ? `${asset.designCapacity} m\u00B3/min` : undefined} />
      <InfoRow label="ポンプ台数" value={asset.pumpCount != null ? `${asset.pumpCount} \u53F0` : undefined} />
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
  const resolvedName = asset.displayName || asset.nameJa || asset.name || '\u7DD1\u5730';

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge variant="secondary" className={TYPE_CONFIG['green-space'].className}>{TYPE_CONFIG['green-space'].label}</Badge>
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
        variant="outline"
        className="w-full"
        onClick={handleCreateEvent}
      >
        <IconCalendarPlus size={16} className="mr-2" />
        新規イベント作成
      </Button>
    </Stack>
  );
}
