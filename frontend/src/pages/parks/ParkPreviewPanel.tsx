import { useMemo } from 'react';
import { X, ArrowRight, CircleArrowRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MiniMap } from '@/components/MiniMap';
import { useNavigate } from 'react-router-dom';
import { useGreenSpace, useParkFacilitiesByPark } from '../../hooks/useApi';
import { getDummyFacilitiesByPark, FACILITY_CATEGORY_LABELS, FACILITY_STATUS_CONFIG } from '../../data/dummyFacilities';
import type { CuratedPark } from '../../data/curatedParks';

interface ParkPreviewPanelProps {
  park: CuratedPark;
  onClose: () => void;
  onNavigateToDetail: () => void;
}

const fieldRowCls = 'flex items-start justify-between py-2.5 border-b border-[#f5f5f5] text-sm';
const fieldLabelCls = 'text-[#737373] shrink-0';
const fieldValueCls = 'text-right text-[#0a0a0a] ml-4 font-medium';
const sectionTitleCls = 'text-sm font-normal text-[#737373] mt-6 mb-2';

/** Center coordinates for parks (used for dummy geometry when API is unavailable) */
const PARK_CENTERS: Record<string, { center: [number, number]; areaM2: number }> = {
  'GS-zxpnkee2': { center: [136.9213, 35.1575], areaM2: 236537 },
  'GS-nliigh01': { center: [136.9050, 35.1860], areaM2: 205208 },
  'GS-4g77l6x7': { center: [136.9740, 35.1570], areaM2: 894903 },
  'GS-es1u7z8r': { center: [136.8980, 35.1650], areaM2: 89299 },
  'GS-9ego0pvp': { center: [136.8780, 35.2010], areaM2: 426621 },
  'GS-auy42b1p': { center: [136.9410, 35.0780], areaM2: 1102426 },
  'GS-gs3xyhbw': { center: [136.8640, 35.1170], areaM2: 237208 },
  'GS-3d67hwf5': { center: [136.8350, 35.0970], areaM2: 364075 },
  'GS-byrogagk': { center: [136.9110, 35.1720], areaM2: 105736 },
  'GS-ful7d9lw': { center: [136.9340, 35.1870], areaM2: 55029 },
  'GS-7f2voyoy': { center: [137.0100, 35.1780], areaM2: 631296 },
  'GS-x1q5e2te': { center: [137.0200, 35.1650], areaM2: 1351901 },
  'GS-ldnfwyur': { center: [136.9780, 35.2050], areaM2: 131662 },
  'GS-9exy95g1': { center: [136.9370, 35.1060], areaM2: 65235 },
  'GS-xk4kyf2q': { center: [136.9100, 35.2020], areaM2: 51705 },
  'GS-cfam78i3': { center: [136.9370, 35.1350], areaM2: 239836 },
  'GS-gul3d3ul': { center: [136.9080, 35.1280], areaM2: 78109 },
  'GS-rtljov09': { center: [136.9430, 35.1710], areaM2: 58659 },
};

function makeApproxPolygon(center: [number, number], areaM2: number) {
  const side = Math.sqrt(areaM2);
  const latDeg = (side / 2) / 111000;
  const lngDeg = (side / 2) / (111000 * Math.cos((center[1] * Math.PI) / 180));
  const [lng, lat] = center;
  return {
    type: 'Polygon' as const,
    coordinates: [[
      [lng - lngDeg, lat - latDeg],
      [lng + lngDeg, lat - latDeg],
      [lng + lngDeg, lat + latDeg],
      [lng - lngDeg, lat + latDeg],
      [lng - lngDeg, lat - latDeg],
    ]],
  };
}

const MARKER_OFFSETS: Array<[number, number]> = [
  [0.0003, 0.0002], [-0.0002, 0.0003], [0.0002, -0.0002],
  [-0.0003, -0.0002], [0.0004, 0.0001], [-0.0001, 0.0004],
  [0.0003, -0.0003], [-0.0004, 0.0003], [0.0005, 0.0002],
  [-0.0002, -0.0004], [0.0001, 0.0005], [-0.0005, 0.0001],
];

function FieldRow({ label, value, multiline }: { label: string; value: string | number | null | undefined; multiline?: boolean }) {
  const display = value === null || value === undefined || value === '' ? '-' : String(value);
  return (
    <div className={fieldRowCls}>
      <span className={fieldLabelCls}>{label}</span>
      <span className={`${fieldValueCls}${multiline ? ' whitespace-pre-line' : ''}`}>
        {display}
      </span>
    </div>
  );
}

function ParkMapTab({ parkId }: { parkId: string }) {
  const { data: parkData, isLoading } = useGreenSpace(parkId);
  const { data: facilitiesData } = useParkFacilitiesByPark(parkId);

  const dummyInfo = PARK_CENTERS[parkId];
  const geometry = parkData?.geometry
    || (!isLoading && dummyInfo
      ? makeApproxPolygon(dummyInfo.center, dummyInfo.areaM2)
      : undefined);

  const centroid = dummyInfo?.center || [136.9, 35.15];

  const apiFacilities = facilitiesData?.features || [];
  const dummyFacilities = getDummyFacilitiesByPark(parkId).map((f, i) => ({
    properties: f,
    geometry: {
      type: 'Point' as const,
      coordinates: [
        centroid[0] + (MARKER_OFFSETS[i % MARKER_OFFSETS.length][0]),
        centroid[1] + (MARKER_OFFSETS[i % MARKER_OFFSETS.length][1]),
      ],
    },
  }));
  const facilities = apiFacilities.length > 0 ? apiFacilities : dummyFacilities;

  const facilityMarkers = useMemo(() => {
    return facilities
      .filter((f: any) => f.geometry?.type === 'Point')
      .map((f: any) => ({
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        color: '#3B82F6',
      }));
  }, [facilities]);

  if (!geometry && isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#737373]">
        読み込み中...
      </div>
    );
  }

  if (!geometry) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#737373]">
        地図データがありません
      </div>
    );
  }

  return (
    <div className="p-4 h-full">
      <MiniMap
        key={parkId}
        geometry={geometry}
        markers={facilityMarkers}
        height="100%"
        fillColor="#3B82F6"
        fillOpacity={0.3}
        markerType="circle"
      />
    </div>
  );
}

const facilityHeaderCls = 'text-xs font-medium text-[#737373] py-2 px-2';

function StatusBadge({ status }: { status: string }) {
  const config = FACILITY_STATUS_CONFIG[status] || { label: status, className: 'bg-gray-400 text-white' };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}

function FacilityPlaceholderImage({ category }: { category: string }) {
  const label = FACILITY_CATEGORY_LABELS[category]?.[0] || '?';
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded bg-[#f0f0f0] text-xs text-[#737373]">
      {label}
    </div>
  );
}

function ParkFacilitiesTab({ parkId, parkName }: { parkId: string; parkName: string }) {
  const navigate = useNavigate();
  const { data: facilitiesData, isLoading } = useParkFacilitiesByPark(parkId);

  const apiFacilities = facilitiesData?.features || [];
  const dummyFacilities = getDummyFacilitiesByPark(parkId);

  // Assign varied demo statuses based on index for visual variety
  const DEMO_STATUSES = ['active', 'underRepair', 'suspended', 'active', 'active', 'underRepair', 'active', 'suspended'];
  const facilities = apiFacilities.length > 0
    ? apiFacilities.map((f: any, i: number) => ({
        ...f.properties,
        status: DEMO_STATUSES[i % DEMO_STATUSES.length],
      }))
    : dummyFacilities;

  if (isLoading && apiFacilities.length === 0 && dummyFacilities.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#737373]">
        読み込み中...
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#737373]">
        施設データがありません
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-3">
        {/* Header row */}
        <div className="flex items-center border-b border-[#f5f5f5]">
          <div className="w-14 shrink-0" />
          <div className="min-w-0 flex-1" />
          <div className={`${facilityHeaderCls} w-[72px] shrink-0 text-center`}>状態</div>
          <div className={`${facilityHeaderCls} w-[64px] shrink-0`}>施設ID</div>
          <div className={`${facilityHeaderCls} w-[64px] shrink-0`}>施設分類</div>
          <div className="w-9 shrink-0" />
        </div>

        {/* Facility rows */}
        {facilities.map((f: any) => (
          <div
            key={f.id}
            className="flex items-center border-b border-[#f5f5f5] py-2.5 px-2 cursor-pointer hover:bg-[#f9f9f9] transition-colors"
            data-testid="facility-row"
            onClick={() => navigate(`/assets/facilities/${f.id}`, {
              state: { breadcrumbFrom: { to: '/assets/parks', label: parkName } },
            })}
          >
            <div className="w-14 shrink-0 flex items-center justify-center">
              <FacilityPlaceholderImage category={f.category} />
            </div>
            <div className="min-w-0 flex-1 px-1">
              <span className="text-xs text-[#0a0a0a] truncate block">{f.name}</span>
            </div>
            <div className="w-[72px] shrink-0 flex items-center justify-center">
              <StatusBadge status={f.status} />
            </div>
            <div className="w-[64px] shrink-0 text-xs text-[#0a0a0a] truncate px-2">
              {f.facilityId || '—'}
            </div>
            <div className="w-[64px] shrink-0 text-xs text-[#0a0a0a] truncate px-2">
              {FACILITY_CATEGORY_LABELS[f.category] || f.category}
            </div>
            <div className="w-9 shrink-0 flex items-center justify-center">
              <CircleArrowRight
                className="size-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/assets/facilities/${f.id}`, {
                    state: { breadcrumbFrom: { to: '/assets/parks', label: parkName } },
                  });
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export function ParkPreviewPanel({ park, onClose, onNavigateToDetail }: ParkPreviewPanelProps) {
  return (
    <Tabs defaultValue="info" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#e5e5e5] px-5 shrink-0">
        <TabsList variant="line" className="h-auto gap-6 p-0">
          <TabsTrigger value="info" className="px-0 py-2 text-sm">情報</TabsTrigger>
          <TabsTrigger value="map" className="px-0 py-2 text-sm">地図</TabsTrigger>
          <TabsTrigger value="facilities" className="px-0 py-2 text-sm">施設</TabsTrigger>
        </TabsList>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center border-none bg-transparent p-0 text-[#737373] hover:text-[#0a0a0a] hover:bg-transparent transition-colors"
          aria-label="閉じる"
        >
          <X className="size-4" />
        </button>
      </div>

      <TabsContent value="info" className="flex-1 overflow-hidden mt-0">
        <ScrollArea className="h-full">
          <div className="px-5 py-4">
            {/* 基本情報 */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#0a0a0a]">基本情報</span>
              <button
                type="button"
                onClick={onNavigateToDetail}
                className="inline-flex items-center gap-1 rounded-full bg-[#215042] px-2.5 py-0.5 text-xs font-medium text-white hover:bg-[#2a6554] transition-colors"
                data-testid="park-detail-link"
              >
                公園詳細
                <ArrowRight className="size-3" />
              </button>
            </div>
            <FieldRow label="No" value={park.no} />
            <FieldRow label="公園名称" value={park.displayName} />
            <FieldRow label="種別" value={park.category} />
            <FieldRow label="行政区" value={park.ward} />
            <FieldRow label="所在地" value={park.address} />
            <FieldRow label="学区名" value={park.schoolDistrict} />

            {/* 計画・規模・履歴 */}
            <p className={sectionTitleCls}>計画・規模・履歴</p>
            <FieldRow label="面積, ha" value={park.areaHa.toFixed(2)} />
            <FieldRow label="開園年度" value={park.openingYear} />
            <FieldRow label="設置年月日" value={park.establishedDate} />
            <FieldRow label="計画番号" value={park.planNumber} />
            <FieldRow label="計画面積, ha" value={park.plannedAreaHa.toFixed(2)} />
            <FieldRow label="計画決定日" value={park.planDecisionDate} />
            <FieldRow label="取得方法" value={park.acquisitionMethod} />

            {/* 施設・備考 */}
            <p className={sectionTitleCls}>施設・備考</p>
            <FieldRow label="有料施設" value={park.paidFacility} />
            <FieldRow label="防災施設" value={park.disasterFacility} />
            <FieldRow label="備考" value={park.notes?.replace(/<br>/g, '\n')} multiline />
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="map" className="flex-1 mt-0 overflow-hidden">
        <ParkMapTab parkId={park.id} />
      </TabsContent>

      <TabsContent value="facilities" className="flex-1 mt-0 overflow-hidden">
        <ParkFacilitiesTab parkId={park.id} parkName={park.displayName} />
      </TabsContent>
    </Tabs>
  );
}
