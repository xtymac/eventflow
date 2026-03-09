import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconPencil, IconSearch } from '@tabler/icons-react';
import { CircleArrowRight, CalendarDays } from 'lucide-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import * as turf from '@turf/turf';
import { useParkFacility, useGreenSpace, useInspectionsByAsset, useRepairsByAsset } from '../../hooks/useApi';
import { recordVisit } from '../../hooks/useRecentVisits';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { RankBadge } from '../../components/facility/RankBadge';
import { CATEGORY_IMAGES } from '../../components/facility/FacilityPlaceholderImage';
import { getDummyFacility, FACILITY_CLASSIFICATION_LABELS, PARK_NAME_LOOKUP } from '../../data/dummyFacilities';
import { type DummyInspection } from '../../data/dummyInspections';
import { type DummyRepair } from '../../data/dummyRepairs';
import { getCaseById, CASE_STATUS_CONFIG } from '../../data/dummyCases';
import { useScrollRestore } from '../../hooks/useScrollRestore';

// View helper to safely access fields that may only exist on DummyFacility
function f(facility: Record<string, any>, key: string): any {
  return facility[key];
}

type FacilityDetailLocationState = {
  breadcrumbFrom?: {
    to?: string;
    label?: string;
  };
};

/* ── small UI components (matching ParkDetailPage style) ── */

const fieldRowCls = 'flex items-start justify-between gap-2 py-2.5 border-b border-[#f0f0f0] text-sm';
const fieldLabelCls = 'text-xs text-[#737373] shrink-0 whitespace-nowrap leading-5';
const fieldValueCls = 'text-right text-[#0a0a0a] text-sm leading-5';
const sectionTitleCls = 'text-sm font-semibold text-[#0a0a0a] mt-6 mb-2';

function FieldRow({ label, value, multiline, testId }: { label: string; value: React.ReactNode; multiline?: boolean; testId?: string }) {
  const display = value === null || value === undefined || value === '' ? '-' : value;
  return (
    <div className={fieldRowCls} data-testid={testId}>
      <span className={fieldLabelCls}>{label}</span>
      <span className={`${fieldValueCls}${multiline ? ' break-words max-w-[70%]' : ' whitespace-nowrap'}`}>{display}</span>
    </div>
  );
}

export function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  /* Layout refs */
  const pageScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestore(pageScrollRef as RefObject<HTMLElement>);
  const leftInfoScrollRef = useRef<HTMLDivElement>(null);

  /** Seamless scroll chaining: when the left info panel hits its scroll
   *  boundary, temporarily disable its overflow so the wheel event
   *  naturally bubbles to the page scroll container. */
  useEffect(() => {
    const panel = leftInfoScrollRef.current;
    if (!panel) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function onWheel(e: WheelEvent) {
      const EPSILON = 1;
      const atTop = panel!.scrollTop <= EPSILON;
      const atBottom = panel!.scrollTop + panel!.clientHeight >= panel!.scrollHeight - EPSILON;
      const scrollingDown = e.deltaY > 0;

      if ((scrollingDown && atBottom) || (!scrollingDown && atTop)) {
        panel!.style.overflowY = 'hidden';
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { panel!.style.overflowY = 'auto'; }, 80);
      }
    }

    panel.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      panel.removeEventListener('wheel', onWheel);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // API data
  const { data, isLoading, isError } = useParkFacility(id ?? null);
  const apiFacility = data?.properties;
  const dummyFacility = id ? getDummyFacility(id) : null;
  const facility = apiFacility || dummyFacility;
  const usingDummy = !apiFacility && !!dummyFacility;
  const facilityGeometry = data?.geometry;

  // Park geometry for map
  const { data: parkData } = useGreenSpace(facility?.greenSpaceRef ?? null);
  const parkGeometry = parkData?.geometry;

  // Inspection/repair data (dummy data filtered by facility ID)
  const { data: inspectionData } = useInspectionsByAsset('park-facility', id ?? null);
  const { data: repairData } = useRepairsByAsset('park-facility', id ?? null);
  const inspections: DummyInspection[] = (inspectionData?.data ?? []) as DummyInspection[];
  const repairs: DummyRepair[] = (repairData?.data ?? []) as DummyRepair[];

  // Map setup
  const miniMapGeometry = parkGeometry || facilityGeometry;
  const isDummyFacility = id?.startsWith('PF-demo-') ?? false;
  const markers = (() => {
    if (isDummyFacility && parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
      return [{ lng: c[0], lat: c[1] }];
    }
    if (facilityGeometry?.type === 'Point') {
      return [{
        lng: (facilityGeometry as GeoJSON.Point).coordinates[0],
        lat: (facilityGeometry as GeoJSON.Point).coordinates[1],
      }];
    }
    return [];
  })();

  // Navigation state
  const locationState = location.state as FacilityDetailLocationState | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/assets/facilities';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '施設';

  // Park name resolution
  const parkName = parkData?.properties?.name || (facility?.greenSpaceRef ? PARK_NAME_LOOKUP[facility.greenSpaceRef] : null);

  // Record visit
  useEffect(() => {
    if (id && facility) {
      const name = facility.name;
      if (name) recordVisit(`/assets/facilities/${id}`, name);
    }
  }, [id, facility]);

  // Classification label (facilityClassification is only on DummyFacility)
  const facClassification = facility ? f(facility, 'facilityClassification') : undefined;
  const classificationLabel = facClassification
    ? FACILITY_CLASSIFICATION_LABELS[facClassification] || facClassification
    : '-';

  // ── Inspection filters ──
  const [inspSearch, setInspSearch] = useState('');
  const [inspDate, setInspDate] = useState('');
  const [inspInspector, setInspInspector] = useState('all');
  const [inspStructureRank, setInspStructureRank] = useState('all');
  const [inspWearRank, setInspWearRank] = useState('all');

  const inspInspectors = useMemo(() => [...new Set(inspections.map((i) => i.inspector))], [inspections]);

  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      if (inspSearch) {
        const q = inspSearch.toLowerCase();
        if (!(i.structureMaterialNotes ?? '').toLowerCase().includes(q) && !(i.wearMaterialNotes ?? '').toLowerCase().includes(q)) return false;
      }
      if (inspDate && !i.date.startsWith(inspDate)) return false;
      if (inspInspector !== 'all' && i.inspector !== inspInspector) return false;
      if (inspStructureRank !== 'all' && i.structureRank !== inspStructureRank) return false;
      if (inspWearRank !== 'all' && i.wearRank !== inspWearRank) return false;
      return true;
    });
  }, [inspections, inspSearch, inspDate, inspInspector, inspStructureRank, inspWearRank]);

  const clearInspFilters = () => {
    setInspSearch('');
    setInspDate('');
    setInspInspector('all');
    setInspStructureRank('all');
    setInspWearRank('all');
  };

  // ── Repair filters ──
  const [repSearch, setRepSearch] = useState('');
  const [repDate, setRepDate] = useState('');
  const [repVendor, setRepVendor] = useState('all');

  // Photo carousel state
  const [photoIndex, setPhotoIndex] = useState(0);

  // Breadcrumb shadow on scroll
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const repVendors = useMemo(() => [...new Set(repairs.filter((r) => r.vendor).map((r) => r.vendor!))], [repairs]);

  const filteredRepairs = useMemo(() => {
    return repairs.filter((r) => {
      if (repSearch) {
        const q = repSearch.toLowerCase();
        if (
          !(r.mainReplacementParts ?? '').toLowerCase().includes(q) &&
          !r.description.toLowerCase().includes(q) &&
          !(r.repairNotes ?? '').toLowerCase().includes(q) &&
          !(r.designDocNumber ?? '').toLowerCase().includes(q)
        ) return false;
      }
      if (repDate && !r.date.startsWith(repDate)) return false;
      if (repVendor !== 'all' && r.vendor !== repVendor) return false;
      return true;
    });
  }, [repairs, repSearch, repDate, repVendor]);

  const clearRepFilters = () => {
    setRepSearch('');
    setRepDate('');
    setRepVendor('all');
  };

  /* Navigate to case */
  const goToCase = (caseId: string) => navigate(`/cases/${caseId}`, {
    state: { breadcrumbFrom: { to: location.pathname, label: facility?.name || '施設' } },
  });

  return (
    <div ref={pageScrollRef} data-testid="facility-detail-page" className="h-[calc(100vh-60px)] w-full max-w-full overflow-y-auto overflow-x-hidden scrollbar-hidden">
      {/* Sticky breadcrumb bar */}
      <div
        className="sticky top-0 z-10 px-6 py-3 transition-shadow duration-200"
        style={{
          background: '#FFF',
          boxShadow: isScrolled ? '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)' : 'none',
        }}
      >
        <Breadcrumb data-testid="facility-detail-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  if (location.key !== 'default') {
                    navigate(-1);
                  } else {
                    navigate(breadcrumbTo);
                  }
                }}
                className="cursor-pointer"
              >
                {breadcrumbLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {facility ? `${facility.name}・${facility.facilityId}` : '読み込み中...'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="p-6 w-full max-w-full overflow-x-hidden">
        <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={!facility} emptyMessage="施設が見つかりません">
          {facility && (
            <div className="flex flex-col gap-6">
              {/* ═══ Top block: info + map side-by-side ═══ */}
              <div data-testid="facility-detail-top" className="flex gap-6">
                {/* Left: Facility info sections (sticky, scrollable) */}
                <div ref={leftInfoScrollRef} className="flex-1 min-w-0 max-h-[calc(100vh-156px)] overflow-y-auto sticky top-[48px] scrollbar-hidden">
                  {/* 基本属性 */}
                  <div className="flex items-center justify-between mb-1" data-testid="facility-detail-basic-attrs">
                    <span className="text-sm font-semibold text-[#0a0a0a]">基本属性</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <IconPencil size={16} />
                    </Button>
                  </div>
                  <FieldRow label="名称" value={facility.name} testId="prop-name" />
                  <FieldRow
                    label="状態"
                    value={<StatusBadge status={facility.status} />}
                    testId="prop-status"
                  />
                  <FieldRow label="施設ID" value={facility.facilityId} testId="prop-facility-id" />
                  <FieldRow label="施設分類" value={classificationLabel} testId="prop-classification" />
                  <FieldRow
                    label="公園名称"
                    value={
                      parkName ? (
                        <button
                          className="text-sm text-blue-600 underline hover:text-blue-800 border-none bg-transparent p-0"
                          onClick={() => navigate(`/assets/parks/${facility.greenSpaceRef}`, {
                            state: { breadcrumbFrom: { to: location.pathname, label: facility.name || '施設' } },
                          })}
                          data-testid="prop-park-link"
                        >
                          {parkName}
                        </button>
                      ) : '-'
                    }
                  />
                  <FieldRow label="細目" value={f(facility, 'subItem')} />
                  <FieldRow label="細目補足" value={f(facility, 'subItemDetail') || '-'} />
                  <FieldRow label="主要部材" value={f(facility, 'mainMaterial') || facility.material} />
                  <FieldRow
                    label="数量"
                    value={facility.quantity ? `${facility.quantity} 基` : '-'}
                    testId="prop-quantity"
                  />

                  {/* 設置・施工情報 */}
                  <div data-testid="facility-detail-installation-info">
                  <p className={sectionTitleCls}>設置・施工情報</p>
                  <FieldRow
                    label="設置年"
                    value={facility.dateInstalled ? new Date(facility.dateInstalled).toLocaleDateString('ja-JP') : '-'}
                    testId="prop-date-installed"
                  />
                  <FieldRow label="メーカー" value={facility.manufacturer || '-'} />
                  <FieldRow label="設置業者" value={f(facility, 'installer') || '-'} />
                  <FieldRow label="設計書番号" value={f(facility, 'designDocNumber') || '-'} />
                  <FieldRow label="備考" value={f(facility, 'notes') || '-'} multiline testId="prop-notes" />
                  </div>

                  {/* 維持管理・健全度 */}
                  <p className={sectionTitleCls}>維持管理・健全度</p>
                  <FieldRow
                    label="最近点検情報"
                    value={f(facility, 'lastInspectionDate') ? new Date(f(facility, 'lastInspectionDate')).toLocaleDateString('ja-JP') : '-'}
                  />
                  <FieldRow
                    label="構造ランク"
                    value={f(facility, 'structureRank') ? <RankBadge rank={f(facility, 'structureRank')} /> : '-'}
                  />
                  <FieldRow
                    label="消耗ランク"
                    value={f(facility, 'wearRank') ? <RankBadge rank={f(facility, 'wearRank')} /> : '-'}
                  />
                  <FieldRow
                    label="最近修理情報"
                    value={f(facility, 'lastRepairDate') ? new Date(f(facility, 'lastRepairDate')).toLocaleDateString('ja-JP') : '-'}
                  />
                </div>

                {/* Right: Image + Map stacked cards (sticky, ~35% width) */}
                <div data-testid="facility-detail-right-column" className="w-[45%] shrink-0 sticky top-[48px] flex flex-col gap-4">
                  {/* Facility image card (larger) */}
                  {(() => {
                    const category = f(facility, 'category');
                    const dummyCat = dummyFacility ? f(dummyFacility as Record<string, any>, 'category') : undefined;
                    const images = (category ? CATEGORY_IMAGES[category] : undefined)
                      || (dummyCat ? CATEGORY_IMAGES[dummyCat] : undefined)
                      || [];
                    const currentImage = images[photoIndex % images.length];

                    return (
                      <div data-testid="facility-detail-photo-carousel" className="relative rounded-lg overflow-hidden flex-1 min-h-[260px]">
                        <div className="h-full">
                          {currentImage ? (
                            <img
                              src={`/facilities/${currentImage}`}
                              alt={facility.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-full rounded-md bg-[#f5f5f5] flex items-center justify-center">
                              <span className="text-sm text-[#a3a3a3]">画像なし</span>
                            </div>
                          )}
                        </div>
                        {/* Carousel arrows */}
                        {images.length > 1 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute left-2 top-1/2 -translate-y-1/2 size-7 rounded-full bg-[#f5f5f5] border-0 shadow-md hover:bg-[#e5e5e5]"
                              aria-label="前の画像"
                              onClick={() => setPhotoIndex((i) => (i - 1 + images.length) % images.length)}
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8.64645 2.64645C8.84171 2.45118 9.15829 2.45118 9.35355 2.64645C9.54882 2.84171 9.54882 3.15829 9.35355 3.35355L5.70711 7L9.35355 10.6464C9.54882 10.8417 9.54882 11.1583 9.35355 11.3536C9.15829 11.5488 8.84171 11.5488 8.64645 11.3536L4.64645 7.35355C4.45118 7.15829 4.45118 6.84171 4.64645 6.64645L8.64645 2.64645Z" fill="#0A0A0A"/>
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-full bg-[#f5f5f5] border-0 shadow-md hover:bg-[#e5e5e5]"
                              aria-label="次の画像"
                              onClick={() => setPhotoIndex((i) => (i + 1) % images.length)}
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5.35355 2.64645C5.15829 2.45118 4.84171 2.45118 4.64645 2.64645C4.45118 2.84171 4.45118 3.15829 4.64645 3.35355L8.29289 7L4.64645 10.6464C4.45118 10.8417 4.45118 11.1583 4.64645 11.3536C4.84171 11.5488 5.15829 11.5488 5.35355 11.3536L9.35355 7.35355C9.54882 7.15829 9.54882 6.84171 9.35355 6.64645L5.35355 2.64645Z" fill="#0A0A0A"/>
                              </svg>
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Map card (smaller) */}
                  <div data-testid="facility-detail-map" className="rounded-lg bg-white shadow-sm overflow-hidden h-[260px] shrink-0">
                    <MiniMap
                      key={`${id}-${parkGeometry ? 'park' : 'fac'}`}
                      geometry={miniMapGeometry}
                      markers={markers}
                      height="100%"
                      fillColor="#22C55E"
                      focusOnMarkers={markers.length > 0}
                    />
                  </div>
                </div>
              </div>

              {/* ═══ Inspection History ═══ */}
              <div data-testid="facility-detail-inspection-history" className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 w-full min-w-0 max-w-full overflow-hidden">
                <p className="font-semibold text-base mb-3">点検履歴</p>

                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-2 mb-3" data-testid="inspection-filter-bar">
                  <div className="relative w-[280px] shrink-0">
                    <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
                    <Input
                      placeholder="点検内容,備考"
                      value={inspSearch}
                      onChange={(e) => setInspSearch(e.target.value)}
                      className="pl-8 h-9 text-sm"
                      data-testid="inspection-search"
                    />
                  </div>
                  <div className="relative min-w-[140px] shrink-0">
                    <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[#a3a3a3] pointer-events-none" />
                    <Input
                      type="date"
                      placeholder="点検年月日"
                      value={inspDate}
                      onChange={(e) => setInspDate(e.target.value)}
                      className="pl-8 h-9 text-sm"
                      data-testid="inspection-date-filter"
                    />
                  </div>
                  <Select value={inspInspector} onValueChange={setInspInspector}>
                    <SelectTrigger size="sm" className="w-[130px] shrink-0" data-testid="inspection-inspector-filter">
                      <SelectValue placeholder="点検実施者" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">点検実施者</SelectItem>
                      {inspInspectors.map((ins) => (
                        <SelectItem key={ins} value={ins}>{ins}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={inspStructureRank} onValueChange={setInspStructureRank}>
                    <SelectTrigger size="sm" className="w-[120px] shrink-0" data-testid="inspection-structure-rank-filter">
                      <SelectValue placeholder="構造ランク" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">構造ランク</SelectItem>
                      {['A', 'B', 'C', 'D'].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={inspWearRank} onValueChange={setInspWearRank}>
                    <SelectTrigger size="sm" className="w-[120px] shrink-0" data-testid="inspection-wear-rank-filter">
                      <SelectValue placeholder="消耗ランク" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">消耗ランク</SelectItem>
                      {['A', 'B', 'C', 'D'].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={clearInspFilters}
                    className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors cursor-pointer bg-transparent border-none px-2 py-1 whitespace-nowrap shrink-0"
                    data-testid="inspection-clear-filters"
                  >
                    すべてクリア
                  </button>
                </div>

                {/* Table */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                      <TableHead className="w-[60px] text-xs text-[#737373] font-medium whitespace-nowrap">ID</TableHead>
                      <TableHead className="w-[110px] text-xs text-[#737373] font-medium whitespace-nowrap">点検年月日</TableHead>
                      <TableHead className="text-xs text-[#737373] font-medium whitespace-nowrap">点検実施者</TableHead>
                      <TableHead className="w-[80px] text-center text-xs text-[#737373] font-medium whitespace-nowrap">構造ランク</TableHead>
                      <TableHead className="text-xs text-[#737373] font-medium whitespace-nowrap">構造部材備考</TableHead>
                      <TableHead className="w-[80px] text-center text-xs text-[#737373] font-medium whitespace-nowrap">消耗ランク</TableHead>
                      <TableHead className="text-xs text-[#737373] font-medium whitespace-nowrap">消耗部材備考</TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInspections.length > 0 ? (
                      filteredInspections.map((insp) => {
                        const inspCaseId = insp.eventId && getCaseById(insp.eventId) ? insp.eventId : null;
                        return (
                        <TableRow
                          key={insp.id}
                          className={inspCaseId ? 'cursor-pointer hover:bg-[#f5f5f5] transition-colors' : ''}
                          data-testid="facility-detail-inspection-row"
                          onClick={inspCaseId ? () => goToCase(inspCaseId) : undefined}
                        >
                          <TableCell className="text-xs text-[#0a0a0a]">{insp.id}</TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{new Date(insp.date).toLocaleDateString('ja-JP')}</TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{insp.inspector}</TableCell>
                          <TableCell className="text-center">
                            <RankBadge rank={insp.structureRank} />
                          </TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{insp.structureMaterialNotes || '-'}</TableCell>
                          <TableCell className="text-center">
                            <RankBadge rank={insp.wearRank} />
                          </TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{insp.wearMaterialNotes || '-'}</TableCell>
                          <TableCell>
                            {inspCaseId ? (
                              <CircleArrowRight
                                className="size-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  goToCase(inspCaseId);
                                }}
                                data-testid="inspection-detail-link"
                              />
                            ) : (
                              <CircleArrowRight
                                className="size-5 text-muted-foreground/30"
                                data-testid="inspection-detail-link"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          点検履歴データはありません
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* ═══ Repair History ═══ */}
              <div data-testid="facility-detail-repair-history" className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 w-full min-w-0 max-w-full overflow-hidden">
                <p className="font-semibold text-base mb-3">補修履歴</p>

                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-2 mb-3" data-testid="repair-filter-bar">
                  <div className="relative w-[280px] shrink-0">
                    <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
                    <Input
                      placeholder="主な交換部材,補修内容,設計書番号,備考"
                      value={repSearch}
                      onChange={(e) => setRepSearch(e.target.value)}
                      className="pl-8 h-9 text-sm"
                      data-testid="repair-search"
                    />
                  </div>
                  <div className="relative min-w-[140px] shrink-0">
                    <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[#a3a3a3] pointer-events-none" />
                    <Input
                      type="date"
                      placeholder="補修年月日"
                      value={repDate}
                      onChange={(e) => setRepDate(e.target.value)}
                      className="pl-8 h-9 text-sm"
                      data-testid="repair-date-filter"
                    />
                  </div>
                  <Select value={repVendor} onValueChange={setRepVendor}>
                    <SelectTrigger size="sm" className="w-[130px] shrink-0" data-testid="repair-vendor-filter">
                      <SelectValue placeholder="補修業者" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">補修業者</SelectItem>
                      {repVendors.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={clearRepFilters}
                    className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors cursor-pointer bg-transparent border-none px-2 py-1 whitespace-nowrap shrink-0"
                    data-testid="repair-clear-filters"
                  >
                    すべてクリア
                  </button>
                </div>

                {/* Table */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                      <TableHead className="w-[60px] text-xs text-[#737373] font-medium whitespace-nowrap">ID</TableHead>
                      <TableHead className="w-[110px] text-xs text-[#737373] font-medium whitespace-nowrap">補修年月日</TableHead>
                      <TableHead className="text-xs text-[#737373] font-medium whitespace-nowrap">主な交換部材</TableHead>
                      <TableHead className="text-xs text-[#737373] font-medium whitespace-nowrap">補修業者</TableHead>
                      <TableHead className="text-xs text-[#737373] font-medium whitespace-nowrap">補修内容</TableHead>
                      <TableHead className="text-xs text-[#737373] font-medium whitespace-nowrap">補修備考</TableHead>
                      <TableHead className="w-[100px] text-xs text-[#737373] font-medium whitespace-nowrap">設計書番号</TableHead>
                      <TableHead className="w-[80px] text-center text-xs text-[#737373] font-medium whitespace-nowrap">案件状態</TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRepairs.length > 0 ? (
                      filteredRepairs.map((rep) => (
                        <TableRow
                          key={rep.id}
                          data-testid="facility-detail-repair-row"
                          className={rep.caseId ? 'cursor-pointer hover:bg-[#f5f5f5] transition-colors' : ''}
                          onClick={rep.caseId ? () => goToCase(rep.caseId!) : undefined}
                        >
                          <TableCell className="text-xs text-[#0a0a0a]">{rep.id}</TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{new Date(rep.date).toLocaleDateString('ja-JP')}</TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{rep.mainReplacementParts || '-'}</TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{rep.vendor || '-'}</TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{rep.description}</TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{rep.repairNotes || '-'}</TableCell>
                          <TableCell className="text-xs text-[#0a0a0a]">{rep.designDocNumber || '-'}</TableCell>
                          <TableCell className="text-center" data-testid="repair-case-status">
                            {(() => {
                              const linkedCase = rep.caseId ? getCaseById(rep.caseId) : undefined;
                              if (!linkedCase) return '-';
                              const cfg = CASE_STATUS_CONFIG[linkedCase.status];
                              return (
                                <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
                                  {cfg.label}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-center">
                            {rep.caseId ? (
                              <CircleArrowRight
                                className="size-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                onClick={(e) => { e.stopPropagation(); goToCase(rep.caseId!); }}
                                data-testid="repair-detail-link"
                              />
                            ) : (
                              <CircleArrowRight className="size-5 text-[#e5e5e5]" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          補修履歴データはありません
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </PageState>
      </div>
    </div>
  );
}
