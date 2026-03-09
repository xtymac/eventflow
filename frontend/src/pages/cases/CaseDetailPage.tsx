import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { IconPhoto, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Maximize2 } from 'lucide-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import * as turf from '@turf/turf';
import { AnimatePresence, motion } from 'motion/react';
import { useEvent, useInspection, useUpdateInspection, useRepair, useUpdateRepair, useInspections, useGreenSpace } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { recordVisit } from '../../hooks/useRecentVisits';
import { MiniMap } from '../../components/MiniMap';
import { getDummyEventParkId } from '../../data/dummyEvents';
import { DUMMY_CASES, CASE_URGENCY_CONFIG, calculateUrgency, type DummyCase } from '../../data/dummyCases';
import { DUMMY_INSPECTIONS } from '../../data/dummyInspections';
import { DUMMY_REPAIRS } from '../../data/dummyRepairs';
import { getDummyFacility, PARK_NAME_LOOKUP } from '../../data/dummyFacilities';
import { DUMMY_PARK_FACILITIES } from '../../data/dummyParkFacilities';
import { CATEGORY_IMAGES } from '../../components/facility/FacilityPlaceholderImage';
import { useScrollRestore } from '../../hooks/useScrollRestore';

/* ══════════════════════════════════════════════════════════════
   Shared helpers
   ══════════════════════════════════════════════════════════════ */

type CaseDetailLocationState = {
  breadcrumbFrom?: { to?: string; label?: string };
};

/* ══════════════════════════════════════════════════════════════
   InspectionCaseDetailView — 点検 type (Figma-matched layout)
   ══════════════════════════════════════════════════════════════ */

/* Figma-matched field row */
const fieldRowCls = 'flex items-center justify-between py-2.5 border-b border-[#f0f0f0]';
const fieldLabelCls = 'text-xs text-[#737373] shrink-0';
const fieldValueCls = 'text-sm text-right text-[#0a0a0a] ml-4';

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  const display = value === null || value === undefined || value === '' ? '-' : value;
  return (
    <div className={fieldRowCls}>
      <span className={fieldLabelCls}>{label}</span>
      <span className={fieldValueCls}>{display}</span>
    </div>
  );
}

/* Circular rank badge (rounded-full, A/B/C/D differentiated by color) */
const rankColors: Record<string, string> = {
  A: 'bg-[#22C55E] text-white',
  B: 'bg-[#FACC15] text-[#713F12]',
  C: 'bg-[#F87171] text-white',
  D: 'bg-[#6B7280] text-white',
};

function CircleRankBadge({ rank }: { rank?: string }) {
  if (!rank) return <span className="text-sm text-[#0a0a0a]">-</span>;
  return (
    <span className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-bold ${rankColors[rank] || 'bg-gray-200 text-gray-700'}`}>
      {rank}
    </span>
  );
}

/* Pill-shaped urgency badge (Figma: rounded-full pill) */
function CircleUrgencyBadge({ level }: { level?: string }) {
  if (!level) return <span className="text-sm text-[#0a0a0a]">-</span>;
  const cfg = CASE_URGENCY_CONFIG[level];
  if (!cfg) return <span className="text-sm text-[#0a0a0a]">{level}</span>;
  return (
    <span className={`inline-flex items-center justify-center rounded-full text-sm font-normal px-2 py-0.5 ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

/* Status pill for inspection detail */
const inspStatusCfg: Record<string, { label: string; cls: string; particleColor: string }> = {
  pending: { label: '未確認', cls: 'bg-[#f5f5f5] text-[#404040] border border-[#d4d4d4]', particleColor: '#a3a3a3' },
  returned: { label: '差戻', cls: 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]', particleColor: '#F59E0B' },
  confirmed: { label: '確認済', cls: 'bg-[#D1FAE5] text-[#065F46] border border-[#10B981]', particleColor: '#10B981' },
};

function InspectionStatusPill({ status }: { status: string }) {
  const cfg = inspStatusCfg[status] || { label: status, cls: 'bg-gray-200 text-gray-700', particleColor: '#9ca3af' };
  const prevStatusRef = useRef(status);
  const [particles, setParticles] = useState<{ id: number; r: number; angle: number }[]>([]);

  useEffect(() => {
    if (prevStatusRef.current !== status && status === 'confirmed') {
      // Fire particles when changing TO confirmed
      const newParticles = Array.from({ length: 12 }).map((_, i) => ({
        id: Date.now() + i,
        // Random distance 30-50px for a larger explosion
        r: 30 + Math.random() * 20,
        // Distribute evenly around a circle with some noise
        angle: (i * 30 + (Math.random() - 0.5) * 20) * (Math.PI / 180),
      }));
      setParticles(newParticles);
      // Clean up after animation
      setTimeout(() => setParticles([]), 1000);
    }
    prevStatusRef.current = status;
  }, [status]);

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Particle layer */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{
              scale: [0, 1, 0],
              x: Math.cos(p.angle) * p.r,
              y: Math.sin(p.angle) * p.r,
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute left-1/2 top-1/2 rounded-full w-1.5 h-1.5 -ml-[3px] -mt-[3px]"
            style={{ backgroundColor: cfg.particleColor }}
          />
        ))}
      </AnimatePresence>

      <motion.span
        layout
        className={`relative z-10 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-sm font-medium transition-colors duration-300 ${cfg.cls}`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, position: 'absolute' }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {cfg.label}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </div>
  );
}

/* Inline confirmation popover — drops below the triggering button */
function ConfirmPopover({ variant = 'green', onConfirm, onCancel }: { variant?: 'green' | 'red'; onConfirm: () => void; onCancel: () => void }) {
  const confirmCls = variant === 'red'
    ? 'rounded-full border border-[#dc2626] bg-white px-6 py-2 text-sm text-[#dc2626] hover:bg-red-50 transition-colors min-w-[100px]'
    : 'rounded-full border border-[#215042] bg-white px-6 py-2 text-sm text-[#215042] hover:bg-[#f0fdf4] transition-colors min-w-[100px]';
  return (
    <div className="absolute right-0 top-full mt-2 z-20 inline-flex flex-col items-start gap-3 p-3 rounded-lg shadow-sm border border-[#e5e5e5] bg-white">
      <p className="text-sm font-medium whitespace-nowrap">この操作を実行しますか？</p>
      <div className="flex items-center gap-3">
        <button
          className="rounded-full border border-[#d4d4d4] bg-white px-6 py-2 text-sm text-[#404040] hover:bg-[#f5f5f5] transition-colors min-w-[100px]"
          onClick={onCancel}
        >
          キャンセル
        </button>
        <button className={confirmCls} onClick={onConfirm}>
          はい
        </button>
      </div>
    </div>
  );
}

function InspectionCaseDetailView({ caseData: initialCaseData }: { caseData: DummyCase }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as CaseDetailLocationState | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/cases/inspections';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '点検';

  // Local status state so confirmation updates the UI
  const [status, setStatus] = useState(initialCaseData.status);
  const caseData = { ...initialCaseData, status };

  // Inline confirmation popover state
  const [showConfirm, setShowConfirm] = useState(false);

  const doConfirm = () => {
    initialCaseData.status = 'confirmed';
    initialCaseData.lastStatusChange = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    setStatus('confirmed');
    setShowConfirm(false);
  };

  // Matching inspection record via eventId link
  const inspection = useMemo(
    () => DUMMY_INSPECTIONS.find((i) => i.eventId === String(caseData.id)),
    [caseData.id],
  );

  // Linked facility for image — prefer the inspection's own facilityId, fallback to the case's facilityRef
  const linkedFacility = useMemo(() => {
    const fromInspection = inspection?.facilityId ? getDummyFacility(inspection.facilityId) : null;
    return fromInspection ?? getDummyFacility(caseData.facilityRef);
  }, [inspection?.facilityId, caseData.facilityRef]);
  const categoryImages = linkedFacility?.category ? CATEGORY_IMAGES[linkedFacility.category] : undefined;

  // Park geometry for MiniMap
  const { data: parkData } = useGreenSpace(caseData.parkRef);
  const parkGeometry = parkData?.geometry ?? null;

  // Marker at park centroid
  const facilityMarker = useMemo(() => {
    if (parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
      return [{ lng: c[0], lat: c[1] }];
    }
    return [];
  }, [parkGeometry]);

  // Photo carousel state — show all available category images
  const apiPhotos = (inspection as { mediaUrls?: string[] } | undefined)?.mediaUrls?.length
    ? (inspection as { mediaUrls?: string[] }).mediaUrls!
    : null;
  const photos: string[] = apiPhotos ?? (categoryImages ? categoryImages.map((f) => `/facilities/${f}`) : []);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Record visit for sidebar "最近" section
  useEffect(() => {
    recordVisit(`/cases/${caseData.id}`, `点検, ${caseData.id}`);
  }, [caseData.id]);

  // Breadcrumb shadow on scroll
  const pageScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestore(pageScrollRef as RefObject<HTMLElement>);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={pageScrollRef} data-testid="case-detail-page" className="h-[calc(100vh-67px)] w-full overflow-y-auto scrollbar-hidden">
      {/* ── Breadcrumb ── */}
      <div
        className="sticky top-0 z-10 px-6 py-3 transition-shadow duration-200"
        style={{
          background: '#FFF',
          boxShadow: isScrolled ? '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)' : 'none',
        }}
      >
        <Breadcrumb data-testid="case-detail-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  if (location.key !== 'default') navigate(-1);
                  else navigate(breadcrumbTo);
                }}
                className="cursor-pointer"
              >
                {breadcrumbLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{caseData.id}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* ── Info banner (hidden for confirmed) ── */}
      <AnimatePresence>
        {caseData.status !== 'confirmed' && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16, transitionEnd: { overflow: 'visible' } }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="mx-6 bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex items-center justify-between" data-testid="case-detail-banner">
              <p className="text-sm text-[#737373]">
                点検を確認すると、点検データが施設の基本情報に反映されます
              </p>
              <div className="relative shrink-0">
                <Button
                  className="bg-[#215042] hover:bg-[#1a3f35] text-white rounded-full min-h-[36px] px-4"
                  onClick={() => setShowConfirm((v) => !v)}
                  data-testid="case-confirm-button"
                >
                  確認
                </Button>
                {showConfirm && (
                  <ConfirmPopover onConfirm={doConfirm} onCancel={() => setShowConfirm(false)} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content: 2 columns ── */}
      <div className="px-6 pb-6 flex gap-4">
        {/* Left: Info card */}
        <div
          className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex-1 min-w-0 flex flex-col gap-4 overflow-hidden"
          data-testid="case-detail-info"
        >
          {/* 対象施設 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">対象施設</p>
            <div className="flex flex-col">
              <FieldRow label="状態" value={<InspectionStatusPill status={caseData.status} />} />
              <FieldRow label="ID" value={caseData.id} />
              <FieldRow label="最終状態変更日" value={caseData.lastStatusChange} />
              <FieldRow
                label="公園名称"
                value={
                  <button
                    className="text-sm text-blue-500 underline hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
                    onClick={() =>
                      navigate(`/assets/parks/${caseData.parkRef}`, {
                        state: { breadcrumbFrom: { to: `/cases/${caseData.id}`, label: `案件 ${caseData.id}` } },
                      })
                    }
                    data-testid="case-park-link"
                  >
                    {caseData.parkName}
                  </button>
                }
              />
              <FieldRow
                label="施設"
                value={
                  <button
                    className="text-sm text-blue-500 underline hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
                    onClick={() =>
                      navigate(`/assets/facilities/${caseData.facilityRef}`, {
                        state: { breadcrumbFrom: { to: `/cases/${caseData.id}`, label: `案件 ${caseData.id}` } },
                      })
                    }
                    data-testid="case-facility-link"
                  >
                    {caseData.facilityName}, {caseData.facilityId}
                  </button>
                }
              />
            </div>
          </div>

          {/* 点検実施情報 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">点検実施情報</p>
            <div className="flex flex-col">
              <FieldRow
                label="点検年月日"
                value={
                  inspection
                    ? new Date(inspection.date).toLocaleDateString('ja-JP')
                    : caseData.createdDate
                }
              />
              <FieldRow label="点検実施者" value={inspection?.inspector || caseData.vendor} />
            </div>
          </div>

          {/* 点検結果 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">点検結果</p>
            <div className="flex flex-col">
              <FieldRow label="構造ランク" value={<CircleRankBadge rank={inspection?.structureRank} />} />
              <FieldRow label="構造部材備考" value={inspection?.structureMaterialNotes || '-'} />
              <FieldRow label="消耗ランク" value={<CircleRankBadge rank={inspection?.wearRank} />} />
              <FieldRow label="消耗部材備考" value={inspection?.wearMaterialNotes || '-'} />
              <FieldRow label="緊急度" value={<CircleUrgencyBadge level={caseData.urgency} />} />
            </div>
          </div>
        </div>

        {/* Right: Photo + Map */}
        <div className="flex flex-col gap-4 w-[52%] shrink-0">
          {/* Photo carousel card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 443 }}
            data-testid="case-photo-carousel"
          >
            {photos.length > 0 ? (
              <>
                <img src={photos[photoIndex]} alt="" className="w-full h-full object-cover" />
                {photos.length > 1 && (
                  <>
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                    >
                      <IconChevronLeft size={24} />
                    </button>
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                    >
                      <IconChevronRight size={24} />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#fafafa]">
                <IconPhoto size={64} className="text-[#d4d4d4]" />
                <p className="text-sm text-[#a3a3a3] mt-2">写真なし</p>
              </div>
            )}
          </div>

          {/* MiniMap card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 259 }}
            data-testid="case-mini-map"
          >
            <MiniMap
              key={`case-${caseData.id}-${parkGeometry ? 'park' : 'none'}`}
              geometry={parkGeometry ?? undefined}
              markers={facilityMarker}
              height="100%"
              fillColor="#22C55E"
              focusOnMarkers={facilityMarker.length > 0}
            />
            <button
              className="absolute top-2.5 right-2.5 bg-[#f5f5f5] rounded-full p-2.5 hover:bg-[#e5e5e5] transition-colors"
              onClick={() => {
                if (caseData.parkRef) navigate(`/assets/parks/${caseData.parkRef}`);
              }}
            >
              <Maximize2 size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RepairCaseDetailView — 補修 type (Figma-matched layout)
   ══════════════════════════════════════════════════════════════ */

function RepairCaseDetailView({ caseData: initialCaseData }: { caseData: DummyCase }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as CaseDetailLocationState | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/cases/repairs';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '補修';

  // Local status state so confirmation updates the UI
  const [status, setStatus] = useState(initialCaseData.status);
  const caseData = { ...initialCaseData, status };

  // Inline confirmation popover state
  const [activePopover, setActivePopover] = useState<'confirm' | 'return' | null>(null);
  // Matching repair record via caseId link
  const repair = useMemo(
    () => DUMMY_REPAIRS.find((r) => r.caseId === String(caseData.id)),
    [caseData.id],
  );

  // Linked facility for image — prefer the repair's own facilityId, fallback to the case's facilityRef
  const linkedFacility = useMemo(() => {
    const fromRepair = repair?.facilityId ? getDummyFacility(repair.facilityId) : null;
    return fromRepair ?? getDummyFacility(caseData.facilityRef);
  }, [repair?.facilityId, caseData.facilityRef]);
  const categoryImages = linkedFacility?.category ? CATEGORY_IMAGES[linkedFacility.category] : undefined;

  // Park geometry for MiniMap
  const { data: parkData } = useGreenSpace(caseData.parkRef);
  const parkGeometry = parkData?.geometry ?? null;

  // Marker at park centroid
  const facilityMarker = useMemo(() => {
    if (parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
      return [{ lng: c[0], lat: c[1] }];
    }
    return [];
  }, [parkGeometry]);

  // Photo carousel state — show all available category images
  const apiPhotos = (repair as { mediaUrls?: string[] } | undefined)?.mediaUrls?.length
    ? (repair as { mediaUrls?: string[] }).mediaUrls!
    : null;
  const photos: string[] = apiPhotos ?? (categoryImages ? categoryImages.map((f) => `/facilities/${f}`) : []);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Record visit for sidebar "最近" section
  useEffect(() => {
    recordVisit(`/cases/${caseData.id}`, `補修, ${caseData.id}`);
  }, [caseData.id]);

  // Breadcrumb shadow on scroll
  const pageScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestore(pageScrollRef as RefObject<HTMLElement>);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const updateStatus = (newStatus: DummyCase['status']) => {
    initialCaseData.status = newStatus;
    initialCaseData.lastStatusChange = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    setStatus(newStatus);
  };

  const doConfirm = () => {
    updateStatus('confirmed');
    setActivePopover(null);
  };

  const doReturn = () => {
    updateStatus('returned');
    setActivePopover(null);
  };

  const showActionBar = caseData.status !== 'confirmed';

  return (
    <div ref={pageScrollRef} data-testid="repair-detail-page" className="h-[calc(100vh-67px)] w-full overflow-y-auto scrollbar-hidden">
      {/* ── Breadcrumb ── */}
      <div
        className="sticky top-0 z-10 px-6 py-3 transition-shadow duration-200"
        style={{
          background: '#FFF',
          boxShadow: isScrolled ? '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)' : 'none',
        }}
      >
        <Breadcrumb data-testid="repair-detail-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  if (location.key !== 'default') navigate(-1);
                  else navigate(breadcrumbTo);
                }}
                className="cursor-pointer"
              >
                {breadcrumbLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{caseData.id}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* ── Action bar (hidden for confirmed) ── */}
      <AnimatePresence>
        {showActionBar && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16, transitionEnd: { overflow: 'visible' } }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div
              className={`mx-6 bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex items-center justify-between${caseData.status === 'returned' ? ' opacity-50' : ''}`}
              data-testid="repair-detail-banner"
            >
              <p className="text-sm text-[#737373]" style={{ maxWidth: 700 }}>
                {caseData.status === 'returned'
                  ? '修正のため修理を差戻しました。修正後の内容が再提出されるまで、修理の確認はできません'
                  : '内容に問題がなければ確認できます。問題がある場合は、修正のため差戻しできます。いずれの操作も施設情報が更新されます'}
              </p>
              <div className="flex items-center gap-3 shrink-0">
                <div className="relative">
                  <Button
                    className="bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-full min-h-[36px] px-4"
                    disabled={caseData.status === 'returned'}
                    onClick={() => setActivePopover(activePopover === 'return' ? null : 'return')}
                    data-testid="repair-return-button"
                  >
                    差戻し
                  </Button>
                  {activePopover === 'return' && (
                    <ConfirmPopover variant="red" onConfirm={doReturn} onCancel={() => setActivePopover(null)} />
                  )}
                </div>
                <div className="relative">
                  <Button
                    className="bg-[#215042] hover:bg-[#1a3f35] text-white rounded-full min-h-[36px] px-4"
                    disabled={caseData.status === 'returned'}
                    onClick={() => setActivePopover(activePopover === 'confirm' ? null : 'confirm')}
                    data-testid="repair-confirm-button"
                  >
                    確認
                  </Button>
                  {activePopover === 'confirm' && (
                    <ConfirmPopover onConfirm={doConfirm} onCancel={() => setActivePopover(null)} />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content: 2 columns ── */}
      <div className="px-6 pb-6 flex gap-4">
        {/* Left: Info card */}
        <div
          className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex-1 min-w-0 flex flex-col gap-4 overflow-hidden"
          data-testid="repair-detail-info"
        >
          {/* 対象施設 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3" data-testid="repair-section-facility">対象施設</p>
            <div className="flex flex-col">
              <FieldRow label="状態" value={<InspectionStatusPill status={caseData.status} />} />
              <FieldRow label="ID" value={caseData.id} />
              <FieldRow label="最終状態変更日" value={caseData.lastStatusChange} />
              <FieldRow
                label="公園名称"
                value={
                  <button
                    className="text-sm text-blue-500 underline hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
                    onClick={() =>
                      navigate(`/assets/parks/${caseData.parkRef}`, {
                        state: { breadcrumbFrom: { to: `/cases/${caseData.id}`, label: `案件 ${caseData.id}` } },
                      })
                    }
                    data-testid="repair-park-link"
                  >
                    {caseData.parkName}
                  </button>
                }
              />
              <FieldRow
                label="施設"
                value={
                  <button
                    className="text-sm text-blue-500 underline hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
                    onClick={() =>
                      navigate(`/assets/facilities/${caseData.facilityRef}`, {
                        state: { breadcrumbFrom: { to: `/cases/${caseData.id}`, label: `案件 ${caseData.id}` } },
                      })
                    }
                    data-testid="repair-facility-link"
                  >
                    {caseData.facilityName}, {caseData.facilityId}
                  </button>
                }
              />
            </div>
          </div>

          {/* 補修実施・契約情報 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3" data-testid="repair-section-contract">補修実施・契約情報</p>
            <div className="flex flex-col">
              <FieldRow
                label="補修年月日"
                value={
                  repair
                    ? new Date(repair.date).toLocaleDateString('ja-JP')
                    : caseData.createdDate
                }
              />
              <FieldRow label="補修業者" value={repair?.vendor || caseData.vendor} />
              <FieldRow label="設計書番号" value={repair?.designDocNumber || '-'} />
            </div>
          </div>

          {/* 補修内容・詳細 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3" data-testid="repair-section-details">補修内容・詳細</p>
            <div className="flex flex-col">
              <FieldRow label="補修内容" value={repair?.description || '-'} />
              <FieldRow label="主な交換部材" value={repair?.mainReplacementParts || '-'} />
              <FieldRow label="補修備考" value={repair?.repairNotes || '-'} />
            </div>
          </div>
        </div>

        {/* Right: Photo + Map */}
        <div className="flex flex-col gap-4 w-[52%] shrink-0">
          {/* Photo carousel card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 443 }}
            data-testid="repair-photo-carousel"
          >
            {photos.length > 0 ? (
              <>
                <img src={photos[photoIndex]} alt="" className="w-full h-full object-cover" />
                {photos.length > 1 && (
                  <>
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                    >
                      <IconChevronLeft size={24} />
                    </button>
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                    >
                      <IconChevronRight size={24} />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#fafafa]">
                <IconPhoto size={64} className="text-[#d4d4d4]" />
                <p className="text-sm text-[#a3a3a3] mt-2">写真なし</p>
              </div>
            )}
          </div>

          {/* MiniMap card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 259 }}
            data-testid="repair-mini-map"
          >
            <MiniMap
              key={`repair-${caseData.id}-${parkGeometry ? 'park' : 'none'}`}
              geometry={parkGeometry ?? undefined}
              markers={facilityMarker}
              height="100%"
              fillColor="#22C55E"
              focusOnMarkers={facilityMarker.length > 0}
            />
            <button
              className="absolute top-2.5 right-2.5 bg-[#f5f5f5] rounded-full p-2.5 hover:bg-[#e5e5e5] transition-colors"
              onClick={() => {
                if (caseData.parkRef) navigate(`/assets/parks/${caseData.parkRef}`);
              }}
            >
              <Maximize2 size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EventCaseDetailView — original API-based event detail view
   ══════════════════════════════════════════════════════════════ */

/* Event status → pill config (matching InspectionStatusPill style) */
const eventStatusPillCfg: Record<string, { label: string; cls: string }> = {
  pending_review: { label: '提出済', cls: 'bg-blue-100 text-blue-800 border border-blue-300' },
  planned:        { label: '計画中', cls: 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]' },
  active:         { label: '対応中', cls: 'bg-cyan-100 text-cyan-800 border border-cyan-300' },
  closed:         { label: '確認済', cls: 'bg-[#D1FAE5] text-[#065F46] border border-[#10B981]' },
  archived:       { label: 'アーカイブ', cls: 'bg-[#f5f5f5] text-[#404040] border border-[#d4d4d4]' },
  cancelled:      { label: 'キャンセル', cls: 'bg-red-100 text-red-800 border border-red-300' },
};

function EventStatusPill({ status }: { status: string }) {
  const cfg = eventStatusPillCfg[status] || { label: status, cls: 'bg-gray-200 text-gray-700 border border-gray-300' };
  return (
    <span className={`inline-flex items-center justify-center h-7 min-w-7 rounded-full text-xs font-bold px-3 ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function EventCaseDetailView() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as CaseDetailLocationState | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/cases/inspections';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '点検';

  const { data: eventData, isLoading, isError } = useEvent(id ?? null);
  // Use canonical internal event ID for downstream queries (route param may be external case ID)
  const canonicalId = eventData?.data?.id;
  const { data: inspectionsData } = useInspections(canonicalId ?? undefined);

  const event = eventData?.data;
  const inspections = inspectionsData?.data || [];

  const parkId = id ? getDummyEventParkId(id) : null;
  const { data: parkData } = useGreenSpace(parkId);
  const parkGeometry = parkData?.geometry ?? null;

  const facilityMarker = useMemo(() => {
    if (parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
      return [{ lng: c[0], lat: c[1] }];
    }
    if (event?.geometry?.type === 'Point') {
      const [lng, lat] = (event.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates;
      return [{ lng, lat, color: '#e03131' }];
    }
    return [];
  }, [parkGeometry, event?.geometry]);

  const allPhotos = inspections.flatMap((insp) => insp.mediaUrls || []);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Record visit for sidebar "最近" section
  useEffect(() => {
    if (event) {
      recordVisit(`/cases/${canonicalId}`, `案件, ${event.externalCaseId || canonicalId}`);
    }
  }, [canonicalId, event]);

  // Breadcrumb shadow on scroll
  const pageScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestore(pageScrollRef as RefObject<HTMLElement>);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Confirmation popover
  const [showConfirm, setShowConfirm] = useState(false);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-67px)] w-full flex items-center justify-center">
        <p className="text-sm text-[#a3a3a3]">読み込み中...</p>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="h-[calc(100vh-67px)] w-full flex items-center justify-center">
        <p className="text-sm text-[#a3a3a3]">案件が見つかりません</p>
      </div>
    );
  }

  const showActionBar = hasRole(['admin']) && event.status === 'pending_review';

  return (
    <div ref={pageScrollRef} data-testid="case-detail-page" className="h-[calc(100vh-67px)] w-full overflow-y-auto scrollbar-hidden">
      {/* ── Breadcrumb ── */}
      <div
        className="sticky top-0 z-10 px-6 py-3 transition-shadow duration-200"
        style={{
          background: '#FFF',
          boxShadow: isScrolled ? '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)' : 'none',
        }}
      >
        <Breadcrumb data-testid="case-detail-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  if (location.key !== 'default') navigate(-1);
                  else navigate(breadcrumbTo);
                }}
                className="cursor-pointer"
              >
                {breadcrumbLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{event.externalCaseId || event.id}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* ── Action bar (only for pending_review + admin) ── */}
      <AnimatePresence>
        {showActionBar && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16, transitionEnd: { overflow: 'visible' } }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="mx-6 bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex items-center justify-between" data-testid="case-detail-banner">
              <p className="text-sm text-[#737373]">
                案件を確認すると、ステータスが更新されます
              </p>
              <div className="relative shrink-0">
                <Button
                  className="bg-[#215042] hover:bg-[#1a3f35] text-white rounded-full min-h-[36px] px-4"
                  onClick={() => setShowConfirm((v) => !v)}
                  data-testid="case-confirm-button"
                >
                  確認
                </Button>
                {showConfirm && (
                  <ConfirmPopover onConfirm={() => setShowConfirm(false)} onCancel={() => setShowConfirm(false)} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content: 2 columns ── */}
      <div className="px-6 pb-6 flex gap-4">
        {/* Left: Info card */}
        <div
          className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex-1 min-w-0 flex flex-col gap-4 overflow-hidden"
          data-testid="case-detail-info"
        >
          {/* 案件情報 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">案件情報</p>
            <div className="flex flex-col">
              <FieldRow label="状態" value={<EventStatusPill status={event.status} />} />
              <FieldRow label="案件名" value={event.name} />
              <FieldRow label="案件ID" value={event.id} />
              {event.externalCaseId && (
                <FieldRow label="元案件ID" value={event.externalCaseId} />
              )}
              <FieldRow label="区" value={event.ward} />
              <FieldRow label="部署" value={event.department} />
              <FieldRow label="制限種別" value={event.restrictionType} />
              <FieldRow label="作成者" value={event.createdBy} />
            </div>
          </div>

          {/* 期間 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">期間</p>
            <div className="flex flex-col">
              <FieldRow label="開始日" value={event.startDate ? new Date(event.startDate).toLocaleDateString('ja-JP') : '-'} />
              <FieldRow label="終了日" value={event.endDate ? new Date(event.endDate).toLocaleDateString('ja-JP') : '-'} />
              <FieldRow label="更新日" value={event.updatedAt ? new Date(event.updatedAt).toLocaleDateString('ja-JP') : '-'} />
            </div>
          </div>

          {/* 点検情報 */}
          {inspections.length > 0 && (
            <div>
              <p className="font-mono text-base text-[#171717] mb-3">点検情報 ({inspections.length}件)</p>
              <div className="flex flex-col">
                {inspections.map((insp) => (
                  <div
                    key={insp.id}
                    className="flex items-center justify-between py-2.5 border-b border-[#f0f0f0] cursor-pointer hover:bg-[#fafafa] transition-colors -mx-1 px-1 rounded"
                    onClick={() => navigate(`/inspections/${insp.id}`)}
                  >
                    <span className="text-xs text-[#737373] shrink-0">
                      {insp.inspectionDate ? new Date(insp.inspectionDate).toLocaleDateString('ja-JP') : '—'}
                    </span>
                    <span className="text-sm text-right text-[#0a0a0a] ml-4 flex items-center gap-2">
                      {insp.conditionGrade && (
                        <CircleRankBadge rank={insp.conditionGrade} />
                      )}
                      {insp.inspector || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Photo + Map */}
        <div className="flex flex-col gap-4 w-[52%] shrink-0">
          {/* Photo carousel card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 443 }}
            data-testid="case-photo-carousel"
          >
            {allPhotos.length > 0 ? (
              <>
                <img src={allPhotos[photoIndex]} alt="" className="w-full h-full object-cover" />
                {allPhotos.length > 1 && (
                  <>
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i - 1 + allPhotos.length) % allPhotos.length)}
                    >
                      <IconChevronLeft size={24} />
                    </button>
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i + 1) % allPhotos.length)}
                    >
                      <IconChevronRight size={24} />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#fafafa]">
                <IconPhoto size={64} className="text-[#d4d4d4]" />
                <p className="text-sm text-[#a3a3a3] mt-2">写真なし</p>
              </div>
            )}
          </div>

          {/* MiniMap card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 259 }}
            data-testid="case-mini-map"
          >
            <MiniMap
              key={`case-${canonicalId}-${parkGeometry ? 'park' : 'evt'}`}
              geometry={parkGeometry ?? event.geometry}
              markers={facilityMarker}
              height="100%"
              fillColor="#22C55E"
              focusOnMarkers={facilityMarker.length > 0}
            />
            <button
              className="absolute top-2.5 right-2.5 bg-[#f5f5f5] rounded-full p-2.5 hover:bg-[#e5e5e5] transition-colors"
              onClick={() => {
                if (parkId) navigate(`/assets/parks/${parkId}`);
              }}
            >
              <Maximize2 size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ApiInspectionCaseDetailView — API inspection rendered in Figma layout
   ══════════════════════════════════════════════════════════════ */

function ApiInspectionCaseDetailView({ inspectionId }: { inspectionId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as CaseDetailLocationState | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/cases/inspections';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '点検';

  const { data: inspData, isLoading, isError } = useInspection(inspectionId);
  const inspection = inspData?.data;

  // Resolve facility and park from the inspection's assetId
  const assetId = inspection?.assetId ?? '';
  const linkedFacility = useMemo(() => {
    if (!assetId) return null;
    const fromDummy = getDummyFacility(assetId);
    if (fromDummy) return fromDummy;
    const parkFac = DUMMY_PARK_FACILITIES.find((f) => f.properties.id === assetId);
    return parkFac ? parkFac.properties : null;
  }, [assetId]);

  const greenSpaceRef = (linkedFacility as { greenSpaceRef?: string } | null)?.greenSpaceRef ?? '';
  const parkName = greenSpaceRef ? PARK_NAME_LOOKUP[greenSpaceRef] || '-' : '-';
  const categoryImages = linkedFacility?.category ? CATEGORY_IMAGES[linkedFacility.category] : undefined;

  // Park geometry for MiniMap
  const { data: parkData } = useGreenSpace(greenSpaceRef || null);
  const parkGeometry = parkData?.geometry ?? null;

  const facilityMarker = useMemo(() => {
    if (parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
      return [{ lng: c[0], lat: c[1] }];
    }
    if (inspection?.geometry?.type === 'Point') {
      const [lng, lat] = (inspection.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates;
      return [{ lng, lat }];
    }
    return [];
  }, [parkGeometry, inspection?.geometry]);

  // Photos
  const apiPhotos = inspection?.mediaUrls?.length ? inspection.mediaUrls : null;
  const photos: string[] = apiPhotos ?? (categoryImages ? categoryImages.map((f) => `/facilities/${f}`) : []);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Measurements
  const measurements = inspection?.measurements as Record<string, string | undefined> | null;
  const structureRank = measurements?.structureRank;
  const wearRank = measurements?.wearRank;
  const structureMaterialNotes = measurements?.structureMaterialNotes;
  const wearMaterialNotes = measurements?.wearMaterialNotes;

  // Record visit
  useEffect(() => {
    if (inspection) {
      recordVisit(`/cases/${inspectionId}`, `点検, ${inspectionId}`);
    }
  }, [inspectionId, inspection]);

  // Breadcrumb shadow on scroll
  const pageScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestore(pageScrollRef as RefObject<HTMLElement>);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Confirmation
  const updateInspection = useUpdateInspection();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(inspection?.status === 'confirmed');

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-67px)] w-full flex items-center justify-center">
        <p className="text-sm text-[#a3a3a3]">読み込み中...</p>
      </div>
    );
  }

  if (isError || !inspection) {
    return null; // Signal to dispatcher to try EventCaseDetailView
  }

  const status = confirmed ? 'confirmed' : 'pending';

  return (
    <div ref={pageScrollRef} data-testid="case-detail-page" className="h-[calc(100vh-67px)] w-full overflow-y-auto scrollbar-hidden">
      {/* ── Breadcrumb ── */}
      <div
        className="sticky top-0 z-10 px-6 py-3 transition-shadow duration-200"
        style={{
          background: '#FFF',
          boxShadow: isScrolled ? '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)' : 'none',
        }}
      >
        <Breadcrumb data-testid="case-detail-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  if (location.key !== 'default') navigate(-1);
                  else navigate(breadcrumbTo);
                }}
                className="cursor-pointer"
              >
                {breadcrumbLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{inspectionId}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* ── Info banner (hidden for confirmed) ── */}
      <AnimatePresence>
        {!confirmed && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16, transitionEnd: { overflow: 'visible' } }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="mx-6 bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex items-center justify-between" data-testid="case-detail-banner">
              <p className="text-sm text-[#737373]">
                点検を確認すると、点検データが施設の基本情報に反映されます
              </p>
              <div className="relative shrink-0">
                <Button
                  className="bg-[#215042] hover:bg-[#1a3f35] text-white rounded-full min-h-[36px] px-4"
                  onClick={() => setShowConfirm((v) => !v)}
                  data-testid="case-confirm-button"
                >
                  確認
                </Button>
                {showConfirm && (
                  <ConfirmPopover
                    onConfirm={() => {
                      updateInspection.mutate(
                        { id: inspectionId, data: { status: 'confirmed' } },
                        { onSuccess: () => { setConfirmed(true); setShowConfirm(false); } },
                      );
                    }}
                    onCancel={() => setShowConfirm(false)}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content: 2 columns ── */}
      <div className="px-6 pb-6 flex gap-4">
        {/* Left: Info card */}
        <div
          className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex-1 min-w-0 flex flex-col gap-4 overflow-hidden"
          data-testid="case-detail-info"
        >
          {/* 対象施設 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">対象施設</p>
            <div className="flex flex-col">
              <FieldRow label="状態" value={<InspectionStatusPill status={status} />} />
              <FieldRow label="ID" value={inspectionId} />
              <FieldRow
                label="最終状態変更日"
                value={inspection.updatedAt ? new Date(inspection.updatedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/') : '-'}
              />
              {greenSpaceRef && (
                <FieldRow
                  label="公園名称"
                  value={
                    <button
                      className="text-sm text-blue-500 underline hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
                      onClick={() =>
                        navigate(`/assets/parks/${greenSpaceRef}`, {
                          state: { breadcrumbFrom: { to: `/cases/${inspectionId}`, label: `案件 ${inspectionId}` } },
                        })
                      }
                    >
                      {parkName}
                    </button>
                  }
                />
              )}
              {assetId && (
                <FieldRow
                  label="施設"
                  value={
                    <button
                      className="text-sm text-blue-500 underline hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
                      onClick={() =>
                        navigate(`/assets/facilities/${assetId}`, {
                          state: { breadcrumbFrom: { to: `/cases/${inspectionId}`, label: `案件 ${inspectionId}` } },
                        })
                      }
                    >
                      {linkedFacility?.name || assetId}
                    </button>
                  }
                />
              )}
            </div>
          </div>

          {/* 点検実施情報 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">点検実施情報</p>
            <div className="flex flex-col">
              <FieldRow
                label="点検年月日"
                value={inspection.inspectionDate ? new Date(inspection.inspectionDate).toLocaleDateString('ja-JP') : '-'}
              />
              <FieldRow label="点検実施者" value={inspection.inspector || '-'} />
              <FieldRow label="結果" value={inspection.result || '-'} />
            </div>
          </div>

          {/* 点検結果 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">点検結果</p>
            <div className="flex flex-col">
              <FieldRow label="構造ランク" value={<CircleRankBadge rank={structureRank} />} />
              <FieldRow label="構造部材備考" value={structureMaterialNotes || '-'} />
              <FieldRow label="消耗ランク" value={<CircleRankBadge rank={wearRank} />} />
              <FieldRow label="消耗部材備考" value={wearMaterialNotes || '-'} />
              <FieldRow label="緊急度" value={<CircleUrgencyBadge level={calculateUrgency(structureRank, wearRank)} />} />
            </div>
          </div>

        </div>

        {/* Right: Photo + Map */}
        <div className="flex flex-col gap-4 w-[52%] shrink-0">
          {/* Photo carousel card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 443 }}
            data-testid="case-photo-carousel"
          >
            {photos.length > 0 ? (
              <>
                <img src={photos[photoIndex]} alt="" className="w-full h-full object-cover" />
                {photos.length > 1 && (
                  <>
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                    >
                      <IconChevronLeft size={24} />
                    </button>
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                    >
                      <IconChevronRight size={24} />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#fafafa]">
                <IconPhoto size={64} className="text-[#d4d4d4]" />
                <p className="text-sm text-[#a3a3a3] mt-2">写真なし</p>
              </div>
            )}
          </div>

          {/* MiniMap card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 259 }}
            data-testid="case-mini-map"
          >
            <MiniMap
              key={`api-insp-${inspectionId}-${parkGeometry ? 'park' : 'geo'}`}
              geometry={parkGeometry ?? inspection.geometry}
              markers={facilityMarker}
              height="100%"
              fillColor="#22C55E"
              focusOnMarkers={facilityMarker.length > 0}
            />
            {greenSpaceRef && (
              <button
                className="absolute top-2.5 right-2.5 bg-[#f5f5f5] rounded-full p-2.5 hover:bg-[#e5e5e5] transition-colors"
                onClick={() => navigate(`/assets/parks/${greenSpaceRef}`)}
              >
                <Maximize2 size={24} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ApiRepairCaseDetailView — API repair rendered in Figma layout
   ══════════════════════════════════════════════════════════════ */

function ApiRepairCaseDetailView({ repairId }: { repairId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as CaseDetailLocationState | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/cases/repairs';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '補修';

  const { data: repairData, isLoading, isError } = useRepair(repairId);
  const repair = repairData?.data;

  // Resolve facility and park from the repair's assetId
  const assetId = repair?.assetId ?? '';
  const linkedFacility = useMemo(() => {
    if (!assetId) return null;
    const fromDummy = getDummyFacility(assetId);
    if (fromDummy) return fromDummy;
    const parkFac = DUMMY_PARK_FACILITIES.find((f) => f.properties.id === assetId);
    return parkFac ? parkFac.properties : null;
  }, [assetId]);

  const greenSpaceRef = (linkedFacility as { greenSpaceRef?: string } | null)?.greenSpaceRef ?? '';
  const parkName = greenSpaceRef ? PARK_NAME_LOOKUP[greenSpaceRef] || '-' : '-';
  const categoryImages = linkedFacility?.category ? CATEGORY_IMAGES[linkedFacility.category] : undefined;

  // Park geometry for MiniMap
  const { data: parkData } = useGreenSpace(greenSpaceRef || null);
  const parkGeometry = parkData?.geometry ?? null;

  const facilityMarker = useMemo(() => {
    if (parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
      return [{ lng: c[0], lat: c[1] }];
    }
    if (repair?.geometry?.type === 'Point') {
      const [lng, lat] = (repair.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates;
      return [{ lng, lat }];
    }
    return [];
  }, [parkGeometry, repair?.geometry]);

  // Photos
  const apiPhotos = repair?.mediaUrls?.length ? repair.mediaUrls : null;
  const photos: string[] = apiPhotos ?? (categoryImages ? categoryImages.map((f) => `/facilities/${f}`) : []);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Record visit
  useEffect(() => {
    if (repair) {
      recordVisit(`/cases/${repairId}`, `補修, ${repairId}`);
    }
  }, [repairId, repair]);

  // Breadcrumb shadow on scroll
  const pageScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestore(pageScrollRef as RefObject<HTMLElement>);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Confirmation / return popovers
  const updateRepair = useUpdateRepair();
  const [activePopover, setActivePopover] = useState<'confirm' | 'return' | null>(null);
  const initialStatus = repair?.status === 'confirmed' ? 'confirmed' : repair?.status === 'returned' ? 'returned' : 'pending';
  const [status, setStatus] = useState<'pending' | 'returned' | 'confirmed'>(initialStatus);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-67px)] w-full flex items-center justify-center">
        <p className="text-sm text-[#a3a3a3]">読み込み中...</p>
      </div>
    );
  }

  if (isError || !repair) {
    return null; // Signal to dispatcher to try EventCaseDetailView
  }

  const showActionBar = status !== 'confirmed';

  return (
    <div ref={pageScrollRef} data-testid="repair-detail-page" className="h-[calc(100vh-67px)] w-full overflow-y-auto scrollbar-hidden">
      {/* ── Breadcrumb ── */}
      <div
        className="sticky top-0 z-10 px-6 py-3 transition-shadow duration-200"
        style={{
          background: '#FFF',
          boxShadow: isScrolled ? '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)' : 'none',
        }}
      >
        <Breadcrumb data-testid="repair-detail-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  if (location.key !== 'default') navigate(-1);
                  else navigate(breadcrumbTo);
                }}
                className="cursor-pointer"
              >
                {breadcrumbLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{repairId}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* ── Action bar (hidden for confirmed) ── */}
      <AnimatePresence>
        {showActionBar && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16, transitionEnd: { overflow: 'visible' } }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div
              className={`mx-6 bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex items-center justify-between${status === 'returned' ? ' opacity-50' : ''}`}
              data-testid="repair-detail-banner"
            >
              <p className="text-sm text-[#737373]" style={{ maxWidth: 700 }}>
                {status === 'returned'
                  ? '修正のため修理を差戻しました。修正後の内容が再提出されるまで、修理の確認はできません'
                  : '内容に問題がなければ確認できます。問題がある場合は、修正のため差戻しできます。いずれの操作も施設情報が更新されます'}
              </p>
              <div className="flex items-center gap-3 shrink-0">
                <div className="relative">
                  <Button
                    className="bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-full min-h-[36px] px-4"
                    disabled={status === 'returned'}
                    onClick={() => setActivePopover(activePopover === 'return' ? null : 'return')}
                  >
                    差戻し
                  </Button>
                  {activePopover === 'return' && (
                    <ConfirmPopover variant="red" onConfirm={() => {
                      updateRepair.mutate(
                        { id: repairId, data: { status: 'returned' } },
                        { onSuccess: () => { setStatus('returned'); setActivePopover(null); } },
                      );
                    }} onCancel={() => setActivePopover(null)} />
                  )}
                </div>
                <div className="relative">
                  <Button
                    className="bg-[#215042] hover:bg-[#1a3f35] text-white rounded-full min-h-[36px] px-4"
                    disabled={status === 'returned'}
                    onClick={() => setActivePopover(activePopover === 'confirm' ? null : 'confirm')}
                  >
                    確認
                  </Button>
                  {activePopover === 'confirm' && (
                    <ConfirmPopover onConfirm={() => {
                      updateRepair.mutate(
                        { id: repairId, data: { status: 'confirmed' } },
                        { onSuccess: () => { setStatus('confirmed'); setActivePopover(null); } },
                      );
                    }} onCancel={() => setActivePopover(null)} />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content: 2 columns ── */}
      <div className="px-6 pb-6 flex gap-4">
        {/* Left: Info card */}
        <div
          className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex-1 min-w-0 flex flex-col gap-4 overflow-hidden"
          data-testid="repair-detail-info"
        >
          {/* 対象施設 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">対象施設</p>
            <div className="flex flex-col">
              <FieldRow label="状態" value={<InspectionStatusPill status={status} />} />
              <FieldRow label="ID" value={repairId} />
              <FieldRow
                label="最終状態変更日"
                value={repair.createdAt ? new Date(repair.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/') : '-'}
              />
              {greenSpaceRef && (
                <FieldRow
                  label="公園名称"
                  value={
                    <button
                      className="text-sm text-blue-500 underline hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
                      onClick={() =>
                        navigate(`/assets/parks/${greenSpaceRef}`, {
                          state: { breadcrumbFrom: { to: `/cases/${repairId}`, label: `案件 ${repairId}` } },
                        })
                      }
                    >
                      {parkName}
                    </button>
                  }
                />
              )}
              {assetId && (
                <FieldRow
                  label="施設"
                  value={
                    <button
                      className="text-sm text-blue-500 underline hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
                      onClick={() =>
                        navigate(`/assets/facilities/${assetId}`, {
                          state: { breadcrumbFrom: { to: `/cases/${repairId}`, label: `案件 ${repairId}` } },
                        })
                      }
                    >
                      {linkedFacility?.name || assetId}
                    </button>
                  }
                />
              )}
            </div>
          </div>

          {/* 補修実施・契約情報 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">補修実施・契約情報</p>
            <div className="flex flex-col">
              <FieldRow
                label="補修年月日"
                value={repair.repairDate ? new Date(repair.repairDate).toLocaleDateString('ja-JP') : '-'}
              />
              <FieldRow label="補修業者" value={repair.vendor || '-'} />
              <FieldRow label="設計書番号" value={repair.designDocNumber || '-'} />
            </div>
          </div>

          {/* 補修内容・詳細 */}
          <div>
            <p className="font-mono text-base text-[#171717] mb-3">補修内容・詳細</p>
            <div className="flex flex-col">
              <FieldRow label="補修内容" value={repair.description || '-'} />
              <FieldRow label="主な交換部材" value={repair.mainReplacementParts || '-'} />
              <FieldRow label="補修備考" value={repair.repairNotes || '-'} />
            </div>
          </div>
        </div>

        {/* Right: Photo + Map */}
        <div className="flex flex-col gap-4 w-[52%] shrink-0">
          {/* Photo carousel card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 443 }}
            data-testid="repair-photo-carousel"
          >
            {photos.length > 0 ? (
              <>
                <img src={photos[photoIndex]} alt="" className="w-full h-full object-cover" />
                {photos.length > 1 && (
                  <>
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                    >
                      <IconChevronLeft size={24} />
                    </button>
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors"
                      onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                    >
                      <IconChevronRight size={24} />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#fafafa]">
                <IconPhoto size={64} className="text-[#d4d4d4]" />
                <p className="text-sm text-[#a3a3a3] mt-2">写真なし</p>
              </div>
            )}
          </div>

          {/* MiniMap card */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden relative"
            style={{ height: 259 }}
            data-testid="repair-mini-map"
          >
            <MiniMap
              key={`api-repair-${repairId}-${parkGeometry ? 'park' : 'geo'}`}
              geometry={parkGeometry ?? repair.geometry}
              markers={facilityMarker}
              height="100%"
              fillColor="#22C55E"
              focusOnMarkers={facilityMarker.length > 0}
            />
            {greenSpaceRef && (
              <button
                className="absolute top-2.5 right-2.5 bg-[#f5f5f5] rounded-full p-2.5 hover:bg-[#e5e5e5] transition-colors"
                onClick={() => navigate(`/assets/parks/${greenSpaceRef}`)}
              >
                <Maximize2 size={24} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CaseDetailPage — dispatcher
   ══════════════════════════════════════════════════════════════ */

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();

  // Check if this is a DummyCase from the CaseListPage
  const dummyCase = useMemo(
    () => DUMMY_CASES.find((c) => String(c.id) === id),
    [id],
  );

  // 点検 type → Figma-matched inspection detail layout
  if (dummyCase?.type === 'inspection') {
    return <InspectionCaseDetailView caseData={dummyCase} />;
  }

  // 補修 type → Figma-matched repair detail layout
  if (dummyCase?.type === 'repair') {
    return <RepairCaseDetailView caseData={dummyCase} />;
  }

  // Not a dummy case → try API inspection/repair, then fall back to event
  return <ApiOrEventDetailView id={id ?? ''} />;
}

/** Try API inspection and repair in parallel; if found, render matching view; else EventCaseDetailView */
function ApiOrEventDetailView({ id }: { id: string }) {
  const { data: inspData, isLoading: inspLoading } = useInspection(id, { probe: true });
  const { data: repairData, isLoading: repairLoading } = useRepair(id, { probe: true });

  // While probing both APIs, show loading state
  if (inspLoading || repairLoading) {
    return (
      <div className="h-[calc(100vh-67px)] w-full flex items-center justify-center">
        <p className="text-sm text-[#a3a3a3]">読み込み中...</p>
      </div>
    );
  }

  // If found as an inspection, render in Figma layout
  if (inspData?.data) {
    return <ApiInspectionCaseDetailView inspectionId={id} />;
  }

  // If found as a repair, render in Figma layout
  if (repairData?.data) {
    return <ApiRepairCaseDetailView repairId={id} />;
  }

  // Otherwise, try as an event (CE-xxx or external_case_id)
  return <EventCaseDetailView />;
}
