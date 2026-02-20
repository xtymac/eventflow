import { useState, useEffect, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { IconPencil, IconSearch, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { CircleArrowRight } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import * as turf from '@turf/turf';
import { useGreenSpace, useParkFacilitiesByPark } from '../../hooks/useApi';
import { recordVisit } from '../../hooks/useRecentVisits';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';
import {
  getDummyFacilitiesByPark, FACILITY_CLASSIFICATION_LABELS, FACILITY_STATUS_CONFIG,
  type DummyFacility,
} from '../../data/dummyFacilities';
import { CURATED_PARKS, type CuratedPark } from '../../data/curatedParks';

/* ── constants ─────────────────────────────────────────── */

const CURATED_MAP = new Map<string, CuratedPark>(CURATED_PARKS.map(p => [p.id, p]));

const DUMMY_CENTERS: Record<string, { center: [number, number]; areaM2: number }> = Object.fromEntries(
  CURATED_PARKS.map(p => [p.id, { center: centerForPark(p.id), areaM2: p.areaM2 }]),
);

function centerForPark(id: string): [number, number] {
  const map: Record<string, [number, number]> = {
    'GS-zxpnkee2': [136.9213, 35.1575], 'GS-nliigh01': [136.9050, 35.1860],
    'GS-4g77l6x7': [136.9740, 35.1570], 'GS-es1u7z8r': [136.8980, 35.1650],
    'GS-9ego0pvp': [136.8780, 35.2010], 'GS-auy42b1p': [136.9410, 35.0780],
    'GS-gs3xyhbw': [136.8640, 35.1170], 'GS-3d67hwf5': [136.8350, 35.0970],
    'GS-byrogagk': [136.9110, 35.1720], 'GS-ful7d9lw': [136.9340, 35.1870],
    'GS-7f2voyoy': [137.0100, 35.1780], 'GS-x1q5e2te': [137.0200, 35.1650],
    'GS-ldnfwyur': [136.9780, 35.2050], 'GS-9exy95g1': [136.9370, 35.1060],
    'GS-xk4kyf2q': [136.9100, 35.2020], 'GS-cfam78i3': [136.9370, 35.1350],
    'GS-gul3d3ul': [136.9080, 35.1280], 'GS-rtljov09': [136.9430, 35.1710],
  };
  return map[id] || [136.9, 35.15];
}

const MARKER_OFFSETS: Array<[number, number]> = [
  [0.0003, 0.0002], [-0.0002, 0.0003], [0.0002, -0.0002],
  [-0.0003, -0.0002], [0.0004, 0.0001], [-0.0001, 0.0004],
  [0.0003, -0.0003], [-0.0004, 0.0003],
];

/* ── building coverage dummy data ──────────────────────── */

interface CoverageItem {
  type: string;
  property: string;
  buildingArea: number;
  installDate: string;
  inspectionCert: string;
  installPermit: string;
  notes: string;
}

interface CoverageCategory {
  label: string;
  buildingArea: number;
  limitArea: number;
  coverageRate: number;
  buildingAreaDisplay?: string;
  limitAreaDisplay?: string;
  coverageRateDisplay?: string;
  items: CoverageItem[];
}

const BUILDING_COVERAGE: Record<string, CoverageCategory[]> = {
  'GS-4g77l6x7': [
    {
      label: '2%物件(A)',
      buildingArea: 50.94,
      buildingAreaDisplay: '50.94',
      limitArea: 2248,
      limitAreaDisplay: '2,248',
      coverageRate: 0.05,
      coverageRateDisplay: '0.05%',
      items: [
        { type: '便', property: '便所(ゲートボール場)', buildingArea: 17.24, installDate: '1977/03/31', inspectionCert: '有／無', installPermit: '-', notes: '2015/03/05' },
        { type: '便', property: '便所(芝生広場)', buildingArea: 9.24, installDate: '1982/03/26', inspectionCert: '有／無', installPermit: '-', notes: '2015/03/05' },
        { type: '管', property: '器具庫', buildingArea: 1.45, installDate: '2003/03/31', inspectionCert: '有／無', installPermit: '-', notes: 'FRP　児童球技場' },
      ],
    },
    {
      label: '10%物件(B)',
      buildingArea: 187.00,
      buildingAreaDisplay: '187.00',
      limitArea: 26100.00,
      limitAreaDisplay: '26,100.00',
      coverageRate: 0.07,
      coverageRateDisplay: '0.07%',
      items: [],
    },
  ],
  'GS-nliigh01': [
    {
      label: '2%物件(A)', buildingArea: 50.74, limitArea: 2248, coverageRate: 0.05,
      items: [
        { type: '便', property: '便所(ゲートボール場)', buildingArea: 17.24, installDate: '1977/03/31', inspectionCert: '有／無', installPermit: '-', notes: '2015/03/05' },
        { type: '便', property: '便所(芝生広場)', buildingArea: 9.24, installDate: '1982/03/26', inspectionCert: '有／無', installPermit: '-', notes: '2015/03/05' },
        { type: '管', property: '器具庫', buildingArea: 1.45, installDate: '2003/03/31', inspectionCert: '有／無', installPermit: '-', notes: 'FRP　児童球技場' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 187.00, limitArea: 26100.00, coverageRate: 0.07,
      items: [],
    },
  ],
  'GS-zxpnkee2': [
    {
      label: '2%物件(A)', buildingArea: 38.50, limitArea: 4731, coverageRate: 0.01,
      items: [
        { type: '便', property: '便所(正門付近)', buildingArea: 22.30, installDate: '1985/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '管理事務所', buildingArea: 16.20, installDate: '1998/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 142.00, limitArea: 23654.00, coverageRate: 0.01,
      items: [],
    },
  ],
};

/* ── helpers ────────────────────────────────────────────── */

function makeApproxPolygon(center: [number, number], areaM2: number) {
  const side = Math.sqrt(areaM2);
  const latDeg = (side / 2) / 111000;
  const lngDeg = (side / 2) / (111000 * Math.cos((center[1] * Math.PI) / 180));
  const [lng, lat] = center;
  return {
    type: 'Polygon' as const,
    coordinates: [[
      [lng - lngDeg, lat - latDeg], [lng + lngDeg, lat - latDeg],
      [lng + lngDeg, lat + latDeg], [lng - lngDeg, lat + latDeg],
      [lng - lngDeg, lat - latDeg],
    ]],
  };
}

function formatDate(d?: string) {
  if (!d) return '-';
  return d.replace(/-/g, '/');
}

function formatCoverageBuildingArea(cat: CoverageCategory) {
  return cat.buildingAreaDisplay || cat.buildingArea.toFixed(2);
}

function formatCoverageLimitArea(cat: CoverageCategory) {
  return cat.limitAreaDisplay || cat.limitArea.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function formatCoverageRate(cat: CoverageCategory) {
  return cat.coverageRateDisplay || `${cat.coverageRate.toFixed(2)}%`;
}

/* ── small UI components ───────────────────────────────── */

const fieldRowCls = 'flex items-start justify-between py-2.5 border-b border-[#f0f0f0] text-sm';
const fieldLabelCls = 'text-[#737373] shrink-0';
const fieldValueCls = 'text-right text-[#0a0a0a] ml-4 font-medium';
const sectionTitleCls = 'text-sm font-semibold text-[#0a0a0a] mt-6 mb-2';

function FieldRow({ label, value, multiline }: { label: string; value: string | number | null | undefined; multiline?: boolean }) {
  const display = value === null || value === undefined || value === '' ? '-' : String(value);
  return (
    <div className={fieldRowCls}>
      <span className={fieldLabelCls}>{label}</span>
      <span className={`${fieldValueCls}${multiline ? ' whitespace-pre-line' : ''}`}>{display}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = FACILITY_STATUS_CONFIG[status] || { label: status, className: 'bg-gray-400 text-white' };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}

function FacilityPlaceholderImage({ category }: { category: string }) {
  const colors: Record<string, string> = {
    bench: '#8B5E3C', shelter: '#6B8E23', toilet: '#4682B4', playground: '#FF6347',
    lighting: '#FFD700', waterFountain: '#00CED1', signBoard: '#708090',
    pavement: '#A0522D', sportsFacility: '#32CD32', fence: '#808080',
  };
  const bg = colors[category] || '#a0a0a0';
  return (
    <div
      className="flex size-[56px] shrink-0 items-center justify-center rounded-md text-white text-[10px] font-medium"
      style={{ backgroundColor: bg, opacity: 0.8 }}
    >
      {category === 'bench' ? '🪑' : category === 'shelter' ? '⛺' : category === 'toilet' ? '🚻'
        : category === 'playground' ? '🎠' : category === 'lighting' ? '💡' : category === 'waterFountain' ? '🚰'
        : category === 'signBoard' ? '📋' : category === 'pavement' ? '🛤️' : category === 'sportsFacility' ? '⚽' : '📦'}
    </div>
  );
}

function RankBadge({ rank }: { rank?: string }) {
  if (!rank) return <span className="text-xs text-[#a3a3a3]">-</span>;
  const colors: Record<string, string> = {
    A: 'bg-[#22C55E] text-white', B: 'bg-[#FACC15] text-[#713F12]',
    C: 'bg-[#F87171] text-white', D: 'bg-[#6B7280] text-white',
  };
  return (
    <span className={`inline-flex items-center justify-center size-6 rounded text-[10px] font-bold ${colors[rank] || 'bg-gray-200 text-gray-700'}`}>
      {rank}
    </span>
  );
}

function UrgencyBadge({ level }: { level?: string }) {
  if (!level) return <span className="text-xs text-[#a3a3a3]">-</span>;
  const cfg: Record<string, { label: string; cls: string }> = {
    high: { label: '高', cls: 'bg-[#F87171] text-white' },
    medium: { label: '中', cls: 'bg-[#FACC15] text-[#713F12]' },
    low: { label: '低', cls: 'bg-[#22C55E] text-white' },
  };
  const c = cfg[level] || { label: level, cls: 'bg-gray-200 text-gray-700' };
  return (
    <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold ${c.cls}`}>
      {c.label}
    </span>
  );
}

/* ── table column config ───────────────────────────────── */

const thCls = 'text-xs text-[#737373] font-medium whitespace-nowrap';
const tdCls = 'text-xs text-[#0a0a0a] whitespace-nowrap';
const tdDimCls = 'text-xs text-[#a3a3a3] whitespace-nowrap';

const stickyRightStyle: React.CSSProperties = {
  position: 'sticky',
  right: 0,
  backgroundColor: 'white',
  boxShadow: '-4px 0 8px -4px rgba(0,0,0,0.08)',
};

/** Column widths – total determines horizontal scroll extent */
const COL = {
  thumb: 64, name: 80, status: 72, facilityId: 72, classification: 72,
  parkName: 100, subItem: 72, subItemDetail: 72, quantity: 52, installDate: 92,
  elapsedYears: 64, manufacturer: 72, installer: 72, mainMaterial: 120,
  designDoc: 80, inspectionDate: 92, structureRank: 72, wearRank: 72,
  repairDate: 92, managementType: 72, urgency: 72, countermeasure: 72,
  plannedYear: 80, estimatedCost: 90, notes: 200, actions: 48,
} as const;

const TOTAL_WIDTH = Object.values(COL).reduce((s, w) => s + w, 0);

/* ── main component ────────────────────────────────────── */

export function ParkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  /* Scroll-priority refs */
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const leftInfoScrollRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);

  /** Outside the map, wheel drives the left info panel first;
   *  only after it hits its scroll boundary does the page scroll.
   *  Uses native listener with passive:false so preventDefault() works. */
  useEffect(() => {
    const root = pageScrollRef.current;
    if (!root) return;

    function onWheel(e: WheelEvent) {
      if (e.deltaY === 0) return;
      // Inside map → let map handle zoom
      if (mapPanelRef.current?.contains(e.target as Node)) return;
      // Inside left panel → browser scrolls it naturally (then chains to page)
      if (leftInfoScrollRef.current?.contains(e.target as Node)) return;

      // Cursor is outside both left panel and map → redirect to left panel
      const el = leftInfoScrollRef.current;
      if (!el) return;

      const EPSILON = 1;
      if (el.scrollHeight <= el.clientHeight + EPSILON) return;

      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 20;
      else if (e.deltaMode === 2) dy *= el.clientHeight;

      const scrollingDown = dy > 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - EPSILON;
      const atTop = el.scrollTop <= EPSILON;

      if (scrollingDown && atBottom) return;
      if (!scrollingDown && atTop) return;

      el.scrollTop += dy;
      e.preventDefault();
      e.stopPropagation();
    }

    root.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => root.removeEventListener('wheel', onWheel, { capture: true });
  }, []);

  /* API data */
  const { data: parkData, isLoading, isError } = useGreenSpace(id ?? null);
  const { data: facilitiesData, isLoading: facilitiesLoading } = useParkFacilitiesByPark(id ?? null);

  /* Resolve park: API → curated → fallback */
  const apiPark = parkData?.properties;
  const curatedPark = id ? CURATED_MAP.get(id) : undefined;
  const park = apiPark || curatedPark;
  const usingDummy = !apiPark && !!curatedPark;

  /* Geometry */
  const dummyInfo = id ? DUMMY_CENTERS[id] : undefined;
  const geometry = parkData?.geometry
    || (!isLoading && usingDummy && dummyInfo
      ? makeApproxPolygon(dummyInfo.center, dummyInfo.areaM2)
      : undefined);

  /* Facilities */
  const apiFacilities = facilitiesData?.features || [];
  const centroid = geometry
    ? turf.centroid({ type: 'Feature', properties: {}, geometry } as any).geometry.coordinates
    : dummyInfo?.center || null;

  const dummyFacilities = useMemo(() => {
    if (!id) return [];
    return getDummyFacilitiesByPark(id).map((f, i) => ({
      properties: f,
      geometry: {
        type: 'Point' as const,
        coordinates: centroid
          ? [centroid[0] + MARKER_OFFSETS[i % MARKER_OFFSETS.length][0], centroid[1] + MARKER_OFFSETS[i % MARKER_OFFSETS.length][1]]
          : [136.9, 35.15],
      },
    }));
  }, [id, centroid]);

  const facilities = apiFacilities.length > 0 ? apiFacilities : dummyFacilities;
  const parkName = (curatedPark?.displayName || apiPark?.displayName || apiPark?.nameJa || apiPark?.name || '読み込み中...');

  /* Record visit */
  useEffect(() => {
    if (id && parkName && parkName !== '読み込み中...') {
      recordVisit(`/assets/parks/${id}`, parkName);
    }
  }, [id, parkName]);

  /* Facility filter state */
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassification, setFilterClassification] = useState('__all__');
  const [filterStructureRank, setFilterStructureRank] = useState('__all__');
  const [filterWearRank, setFilterWearRank] = useState('__all__');

  const filteredFacilities = useMemo(() => {
    return facilities.filter((f: any) => {
      const p: DummyFacility = f.properties;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!((p.name?.toLowerCase().includes(q)) || (p.facilityId?.toLowerCase().includes(q)))) return false;
      }
      if (filterClassification !== '__all__' && p.facilityClassification !== filterClassification) return false;
      if (filterStructureRank !== '__all__' && p.structureRank !== filterStructureRank) return false;
      if (filterWearRank !== '__all__' && p.wearRank !== filterWearRank) return false;
      return true;
    });
  }, [facilities, searchQuery, filterClassification, filterStructureRank, filterWearRank]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterClassification('__all__');
    setFilterStructureRank('__all__');
    setFilterWearRank('__all__');
  };

  const hasActiveFilters = searchQuery || filterClassification !== '__all__' || filterStructureRank !== '__all__' || filterWearRank !== '__all__';

  /* Map markers */
  const [hoveredFacilityIndex, setHoveredFacilityIndex] = useState<number | null>(null);

  const facilityMarkers = useMemo(() => {
    const markers: Array<{ lng: number; lat: number; color: string }> = [];
    facilities.forEach((f: any) => {
      if (f.geometry?.type !== 'Point') return;
      markers.push({ lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], color: '#e03131' });
    });
    return markers;
  }, [facilities]);

  const facilityToMarkerIdx = useMemo(() => {
    const map = new Map<number, number>();
    let markerIdx = 0;
    facilities.forEach((f: any, i: number) => {
      if (f.geometry?.type !== 'Point') return;
      map.set(i, markerIdx++);
    });
    return map;
  }, [facilities]);

  /* Building coverage */
  const coverageData = id ? (BUILDING_COVERAGE[id] || []) : [];
  const [openCoverage, setOpenCoverage] = useState<Record<number, boolean>>({ 0: true });

  useEffect(() => {
    if (coverageData.length > 0) {
      setOpenCoverage({ 0: true });
      return;
    }
    setOpenCoverage({});
  }, [id, coverageData.length]);

  /* Navigate to facility */
  const goToFacility = (facilityId: string) => {
    navigate(`/assets/facilities/${facilityId}`, {
      state: { breadcrumbFrom: { to: `/assets/parks/${id}`, label: parkName } },
    });
  };

  return (
    <div ref={pageScrollRef} data-testid="park-detail-scroll-root" className="h-[calc(100vh-60px)] w-full max-w-full overflow-y-auto overflow-x-hidden">
      {/* Sticky breadcrumb bar */}
      <div
        className="sticky top-0 z-10 px-6 py-3"
        style={{
          background: '#FFF',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)',
        }}
      >
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  if (location.key !== 'default') navigate(-1);
                  else navigate('/assets/parks');
                }}
                className="cursor-pointer"
              >
                公園
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{parkName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="p-6 w-full max-w-full overflow-x-hidden">
        <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={!park} emptyMessage="公園が見つかりません">
          {park && (
            <div className="flex flex-col gap-6">
              {/* ═══ Two-column: Info + Map ═══ */}
              <div className="flex gap-6 items-start">
                {/* Left: Park info sections */}
                <div ref={leftInfoScrollRef} data-testid="park-basic-info-scroll" className="flex-1 min-w-0 h-[calc(100vh-156px)] overflow-y-auto sticky top-[48px]">
                  {/* 基本情報 */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[#0a0a0a]">基本情報</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <IconPencil size={16} />
                    </Button>
                  </div>
                  <FieldRow label="No" value={curatedPark?.no || (park as any).no} />
                  <FieldRow label="公園名称" value={parkName} />
                  <FieldRow label="種別" value={curatedPark?.category || (park as any).greenSpaceType} />
                  <FieldRow label="行政区" value={curatedPark?.ward || (park as any).ward} />
                  <FieldRow
                    label="所在地"
                    value={curatedPark?.address || (park as any).address}
                    multiline
                  />
                  <FieldRow label="学区名" value={curatedPark?.schoolDistrict || (park as any).schoolDistrict} />

                  {/* 計画・規模・履歴 */}
                  <p className={sectionTitleCls}>計画・規模・履歴</p>
                  <FieldRow label="面積, ha" value={curatedPark?.areaHa?.toFixed(2) || (park as any).areaM2 ? ((park as any).areaM2 / 10000).toFixed(2) : null} />
                  <FieldRow label="開園年度" value={curatedPark?.openingYear} />
                  <FieldRow label="設置年月日" value={curatedPark?.establishedDate} />
                  <FieldRow label="計画番号" value={curatedPark?.planNumber} />
                  <FieldRow label="計画面積, ha" value={curatedPark?.plannedAreaHa?.toFixed(2)} />
                  <FieldRow label="計画決定日" value={curatedPark?.planDecisionDate} />
                  <FieldRow label="取得方法" value={curatedPark?.acquisitionMethod} />

                  {/* 施設・備考 */}
                  <p className={sectionTitleCls}>施設・備考</p>
                  <FieldRow label="有料施設" value={curatedPark?.paidFacility} />
                  <FieldRow label="防災施設" value={curatedPark?.disasterFacility} />
                  <FieldRow label="備考" value={curatedPark?.notes?.replace(/<br>/g, '\n')} multiline />
                </div>

                {/* Right: Map */}
                <div ref={mapPanelRef} data-testid="park-mini-map-panel" className="w-[45%] shrink-0 sticky top-[48px] h-[calc(100vh-156px)]">
                  {geometry ? (
                    <MiniMap
                      key={`${id}-${usingDummy ? 'dummy' : 'api'}-${facilityMarkers.length}`}
                      geometry={geometry}
                      markers={facilityMarkers}
                      height="100%"
                      fillColor="#22C55E"
                      highlightedMarkerIndex={hoveredFacilityIndex != null ? facilityToMarkerIdx.get(hoveredFacilityIndex) ?? null : null}
                    />
                  ) : centroid ? (
                    <MiniMap
                      center={centroid as [number, number]}
                      markers={[{ lng: centroid[0], lat: centroid[1], color: '#22C55E' }, ...facilityMarkers]}
                      zoom={15}
                      height="100%"
                      highlightedMarkerIndex={hoveredFacilityIndex != null ? (facilityToMarkerIdx.get(hoveredFacilityIndex) ?? -1) + 1 : null}
                    />
                  ) : null}
                </div>
              </div>

              {/* ═══ Facilities section ═══ */}
              <div className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 w-full min-w-0 max-w-full overflow-hidden">
                <p className="font-semibold text-base mb-3">施設</p>

                {/* Search + filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="relative w-[280px] shrink-0">
                    <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
                    <Input
                      placeholder="名称, 施設ID, 備考"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>

                  <Select value={filterClassification} onValueChange={setFilterClassification}>
                    <SelectTrigger size="sm" className="w-[130px] shrink-0">
                      <SelectValue placeholder="施設分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">施設分類</SelectItem>
                      {Object.entries(FACILITY_CLASSIFICATION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterStructureRank} onValueChange={setFilterStructureRank}>
                    <SelectTrigger size="sm" className="w-[140px] shrink-0">
                      <SelectValue placeholder="構造ランク" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">構造ランク</SelectItem>
                      {['A', 'B', 'C', 'D'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterWearRank} onValueChange={setFilterWearRank}>
                    <SelectTrigger size="sm" className="w-[140px] shrink-0">
                      <SelectValue placeholder="消耗ランク" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">消耗ランク</SelectItem>
                      {['A', 'B', 'C', 'D'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors cursor-pointer bg-transparent border-none px-2 py-1 whitespace-nowrap shrink-0"
                  >
                    すべてクリア
                  </button>
                </div>

                {/* Facilities table — horizontal scroll */}
                <div className="px-1 pb-2 text-[11px] text-[#a3a3a3]">左右にスクロールして全列を表示</div>
                <PageState loading={!usingDummy && facilitiesLoading} empty={filteredFacilities.length === 0} emptyMessage={hasActiveFilters ? '条件に一致する施設がありません' : 'この公園に施設はありません'}>
                  <div className="w-full max-w-full">
                    <div
                      className="w-full"
                      style={{
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        maxWidth: '100%',
                        scrollbarGutter: 'stable both-edges',
                        WebkitOverflowScrolling: 'touch',
                      }}
                    >
                      <table
                        data-testid="park-facilities-table"
                        className="caption-bottom text-sm"
                        style={{ width: TOTAL_WIDTH, minWidth: TOTAL_WIDTH }}
                      >
                      <TableHeader>
                        <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                          <TableHead style={{ width: COL.thumb, minWidth: COL.thumb }} />
                          <TableHead className={thCls} style={{ width: COL.name, minWidth: COL.name }} />
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.status, minWidth: COL.status }}>状態</TableHead>
                          <TableHead className={thCls} style={{ width: COL.facilityId, minWidth: COL.facilityId }}>施設ID</TableHead>
                          <TableHead className={thCls} style={{ width: COL.classification, minWidth: COL.classification }}>施設分類</TableHead>
                          <TableHead className={thCls} style={{ width: COL.parkName, minWidth: COL.parkName }}>公園名称</TableHead>
                          <TableHead className={thCls} style={{ width: COL.subItem, minWidth: COL.subItem }}>細目</TableHead>
                          <TableHead className={thCls} style={{ width: COL.subItemDetail, minWidth: COL.subItemDetail }}>細目補足</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.quantity, minWidth: COL.quantity }}>数量</TableHead>
                          <TableHead className={thCls} style={{ width: COL.installDate, minWidth: COL.installDate }}>設置年</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.elapsedYears, minWidth: COL.elapsedYears }}>経過年数</TableHead>
                          <TableHead className={thCls} style={{ width: COL.manufacturer, minWidth: COL.manufacturer }}>メーカー</TableHead>
                          <TableHead className={thCls} style={{ width: COL.installer, minWidth: COL.installer }}>設置業者</TableHead>
                          <TableHead className={thCls} style={{ width: COL.mainMaterial, minWidth: COL.mainMaterial }}>主要部材</TableHead>
                          <TableHead className={thCls} style={{ width: COL.designDoc, minWidth: COL.designDoc }}>設計書番号</TableHead>
                          <TableHead className={thCls} style={{ width: COL.inspectionDate, minWidth: COL.inspectionDate }}>最近点検日</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.structureRank, minWidth: COL.structureRank }}>構造ランク</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.wearRank, minWidth: COL.wearRank }}>消耗ランク</TableHead>
                          <TableHead className={thCls} style={{ width: COL.repairDate, minWidth: COL.repairDate }}>直近修理日</TableHead>
                          <TableHead className={thCls} style={{ width: COL.managementType, minWidth: COL.managementType }}>管理種別</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.urgency, minWidth: COL.urgency }}>緊急度判定</TableHead>
                          <TableHead className={thCls} style={{ width: COL.countermeasure, minWidth: COL.countermeasure }}>対策内容</TableHead>
                          <TableHead className={thCls} style={{ width: COL.plannedYear, minWidth: COL.plannedYear }}>実施予定年</TableHead>
                          <TableHead className={`${thCls} text-right`} style={{ width: COL.estimatedCost, minWidth: COL.estimatedCost }}>概算費用</TableHead>
                          <TableHead className={thCls} style={{ width: COL.notes, minWidth: COL.notes }}>備考</TableHead>
                          <TableHead style={{ width: COL.actions, minWidth: COL.actions, ...stickyRightStyle, zIndex: 20 }} className="bg-[#fafafa]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFacilities.map((f: any, i: number) => {
                          const p: DummyFacility = f.properties;
                          return (
                            <TableRow
                              key={p.id}
                              className="cursor-pointer hover:bg-[#f5f5f5] transition-colors"
                              onClick={() => goToFacility(p.id)}
                              onMouseEnter={() => setHoveredFacilityIndex(i)}
                              onMouseLeave={() => setHoveredFacilityIndex(null)}
                            >
                              <TableCell className="p-2" style={{ width: COL.thumb, minWidth: COL.thumb }}>
                                <FacilityPlaceholderImage category={p.category} />
                              </TableCell>
                              <TableCell className="text-sm font-medium text-[#0a0a0a] p-2" style={{ width: COL.name, minWidth: COL.name }}>
                                {p.name}
                              </TableCell>
                              <TableCell className="text-center p-2" style={{ width: COL.status, minWidth: COL.status }}>
                                <StatusBadge status={p.status} />
                              </TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.facilityId || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>
                                {p.facilityClassification ? (FACILITY_CLASSIFICATION_LABELS[p.facilityClassification] || p.facilityClassification) : '-'}
                              </TableCell>
                              <TableCell className="p-2">
                                <Badge variant="secondary" className="bg-[#22C55E]/15 text-[#15803d] text-[10px] font-semibold px-1.5 py-0 rounded whitespace-nowrap">
                                  {parkName}
                                </Badge>
                              </TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.subItem || '-'}</TableCell>
                              <TableCell className={`${tdDimCls} p-2`}>{p.subItemDetail || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2 text-center`}>
                                {p.quantity ? `${p.quantity}基` : '-'}
                              </TableCell>
                              <TableCell className={`${tdCls} p-2`}>{formatDate(p.dateInstalled)}</TableCell>
                              <TableCell className={`${tdCls} p-2 text-center`}>{p.designLife ?? '-'}</TableCell>
                              <TableCell className={`${tdDimCls} p-2`}>{p.manufacturer || '-'}</TableCell>
                              <TableCell className={`${tdDimCls} p-2`}>{p.installer || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.mainMaterial || '-'}</TableCell>
                              <TableCell className={`${tdDimCls} p-2`}>{p.designDocNumber || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>{formatDate(p.lastInspectionDate)}</TableCell>
                              <TableCell className="p-2 text-center"><RankBadge rank={p.structureRank} /></TableCell>
                              <TableCell className="p-2 text-center"><RankBadge rank={p.wearRank} /></TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.lastRepairDate || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.managementType || '-'}</TableCell>
                              <TableCell className="p-2 text-center"><UrgencyBadge level={p.urgencyLevel} /></TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.countermeasure || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.plannedYear || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2 text-right`}>
                                {p.estimatedCost ? `\u00A5${p.estimatedCost.toLocaleString()}` : '-'}
                              </TableCell>
                              <TableCell className={`${tdCls} p-2 max-w-[200px] truncate`}>{p.notes || '-'}</TableCell>
                              <TableCell className="p-2 text-center" style={stickyRightStyle}>
                                <CircleArrowRight
                                  className="size-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                  onClick={(e) => { e.stopPropagation(); goToFacility(p.id); }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      </table>
                    </div>
                  </div>
                </PageState>
              </div>

              {/* ═══ Building coverage section ═══ */}
              {coverageData.length > 0 && (
                <div className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex flex-col gap-2">
                  <p className="font-mono text-base font-normal text-[#171717]">公園内建ぺい率一覧</p>
                  <div className="flex flex-col gap-4">
                    {coverageData.map((cat, ci) => (
                      <Collapsible
                        key={ci}
                        open={openCoverage[ci] ?? false}
                        onOpenChange={(open) => setOpenCoverage(prev => ({ ...prev, [ci]: open }))}
                      >
                        <div>
                          <CollapsibleTrigger className="w-full flex items-center justify-between py-3 cursor-pointer text-left bg-transparent border-none outline-none">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              {openCoverage[ci] ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                              <span className="text-base font-medium">{cat.label}</span>
                            </div>
                            <div className="flex items-center gap-5 w-[330px]">
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">建築面積m2</span>
                                <span className="text-sm font-medium text-foreground">{formatCoverageBuildingArea(cat)}</span>
                              </div>
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">限度面積 m2</span>
                                <span className="text-sm font-medium text-foreground">{formatCoverageLimitArea(cat)}</span>
                              </div>
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">建ﾍﾟｲ率％</span>
                                <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full w-fit">
                                  {formatCoverageRate(cat)}
                                </Badge>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t border-[#e5e5e5] mt-2" />
                            {cat.items.length > 0 ? (
                              <div className="overflow-x-auto">
                                <Table className="w-full">
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent border-0">
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">施設の種別</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">物件</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">建築面積m2</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">設置年月日</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">検査済証の有無</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">設置許可</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">備考</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {cat.items.map((item, ii) => (
                                      <TableRow key={ii} className="bg-[#fafafa] border-b border-[#f5f5f5] last:border-b-0 hover:bg-[#fafafa]">
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.type}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.property}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.buildingArea.toFixed(2)}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.installDate}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.inspectionCert}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.installPermit}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.notes || '-'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                データなし
                              </div>
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </PageState>
      </div>
    </div>
  );
}
