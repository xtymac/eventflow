import { useMemo } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MiniMap } from '@/components/MiniMap';
import { useNavigate } from 'react-router-dom';
import { useGreenSpace } from '../../hooks/useApi';
import { getDummyFacility } from '../../data/dummyFacilities';
import { CATEGORY_IMAGES } from '@/components/facility/FacilityPlaceholderImage';
import { PreviewPhotoTab } from '@/components/preview/PreviewPhotoTab';
import { DUMMY_INSPECTIONS } from '../../data/dummyInspections';
import { DUMMY_REPAIRS } from '../../data/dummyRepairs';
import { CASE_URGENCY_CONFIG, type DummyCase } from '../../data/dummyCases';
import * as turf from '@turf/turf';

interface CasePreviewPanelProps {
  caseData: DummyCase;
  onClose: () => void;
  onNavigateToDetail: () => void;
}

/* ── Style tokens (matching ParkPreviewPanel) ── */
const fieldRowCls = 'flex items-start justify-between py-2.5 border-b border-[#f5f5f5] text-sm';
const fieldLabelCls = 'text-[#737373] shrink-0 text-xs';
const fieldValueCls = 'text-right text-[#0a0a0a] ml-4 text-sm';
const sectionTitleCls = 'font-mono text-base font-normal leading-6 tracking-normal text-[#171717] mt-6 mb-2';

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  const display = value === null || value === undefined || value === '' ? '-' : value;
  return (
    <div className={fieldRowCls}>
      <span className={fieldLabelCls}>{label}</span>
      <span className={fieldValueCls}>{display}</span>
    </div>
  );
}

/* ── Status pill ── */
const statusCfg: Record<string, { label: string; cls: string }> = {
  pending: { label: '未確認', cls: 'bg-[#215042] text-white' },
  returned: { label: '差戻', cls: 'bg-[#F59E0B] text-white' },
  confirmed: { label: '確認済', cls: 'bg-[#10B981] text-white' },
};

function StatusPill({ status }: { status: string }) {
  const cfg = statusCfg[status] || { label: status, cls: 'bg-gray-200 text-gray-700' };
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-sm font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

/* ── Rank badge ── */
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

/* ── Urgency badge ── */
function CircleUrgencyBadge({ level }: { level?: string }) {
  if (!level) return <span className="text-sm text-[#0a0a0a]">-</span>;
  const cfg = CASE_URGENCY_CONFIG[level];
  if (!cfg) return <span className="text-sm text-[#0a0a0a]">{level}</span>;
  return (
    <span className={`inline-flex items-center justify-center h-7 min-w-7 rounded-full text-xs font-bold px-2 ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

/* ── Info tab content ── */
function CaseInfoTab({ caseData, onNavigateToDetail }: { caseData: DummyCase; onNavigateToDetail: () => void }) {
  const navigate = useNavigate();

  const inspection = useMemo(
    () => caseData.type === 'inspection'
      ? DUMMY_INSPECTIONS.find((i) => i.eventId === String(caseData.id))
      : null,
    [caseData.id, caseData.type],
  );

  const repair = useMemo(
    () => caseData.type === 'repair'
      ? DUMMY_REPAIRS.find((r) => r.caseId === String(caseData.id))
      : null,
    [caseData.id, caseData.type],
  );

  const detailLabel = caseData.type === 'inspection' ? '点検詳細' : '補修詳細';

  return (
    <ScrollArea className="h-full">
      <div className="px-5 py-4">
        {/* 対象施設 */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-base font-normal leading-6 tracking-normal text-[#171717]">対象施設</span>
          <button
            type="button"
            onClick={onNavigateToDetail}
            className="inline-flex items-center gap-1 rounded-full border-none bg-[#215042] px-2.5 py-0.5 text-xs font-medium text-white hover:bg-[#2a6554] transition-colors cursor-pointer"
            data-testid="case-detail-link-button"
          >
            {detailLabel}
            <ArrowRight className="size-3" />
          </button>
        </div>
        <FieldRow label="状態" value={<StatusPill status={caseData.status} />} />
        <FieldRow label="ID" value={caseData.id} />
        <FieldRow label="最終状態変更日" value={caseData.lastStatusChange} />
        <FieldRow
          label="公園名称"
          value={
            <button
              type="button"
              className="text-sm text-[#3b82f6] underline decoration-[#3b82f6]/40 hover:decoration-[#3b82f6] bg-transparent border-none p-0 cursor-pointer"
              onClick={() => navigate(`/assets/parks/${caseData.parkRef}`)}
            >
              {caseData.parkName}
            </button>
          }
        />
        <FieldRow
          label="施設"
          value={
            <button
              type="button"
              className="text-sm text-[#3b82f6] underline decoration-[#3b82f6]/40 hover:decoration-[#3b82f6] bg-transparent border-none p-0 cursor-pointer"
              onClick={() => navigate(`/assets/facilities/${caseData.facilityRef}`)}
            >
              {caseData.facilityName}, {caseData.facilityId}
            </button>
          }
        />

        {/* Inspection-specific sections */}
        {caseData.type === 'inspection' && (
          <>
            <p className={sectionTitleCls}>点検実施情報</p>
            <FieldRow
              label="点検年月日"
              value={
                inspection
                  ? new Date(inspection.date).toLocaleDateString('ja-JP')
                  : caseData.createdDate
              }
            />
            <FieldRow label="点検実施者" value={inspection?.inspector || caseData.vendor} />
            <p className={sectionTitleCls}>点検結果</p>
            <FieldRow label="構造ランク" value={<CircleRankBadge rank={inspection?.structureRank} />} />
            <FieldRow label="構造部材備考" value={inspection?.structureMaterialNotes || '-'} />
            <FieldRow label="消耗ランク" value={<CircleRankBadge rank={inspection?.wearRank} />} />
            <FieldRow label="消耗部材備考" value={inspection?.wearMaterialNotes || '-'} />
            <FieldRow label="緊急度" value={<CircleUrgencyBadge level={caseData.urgency} />} />
          </>
        )}

        {/* Repair-specific sections */}
        {caseData.type === 'repair' && (
          <>
            <p className={sectionTitleCls}>補修実施・契約情報</p>
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

            <p className={sectionTitleCls}>補修内容・詳細</p>
            <FieldRow label="補修内容" value={repair?.description || '-'} />
            <FieldRow label="主な交換部材" value={repair?.mainReplacementParts || '-'} />
            <FieldRow label="補修備考" value={repair?.repairNotes || '-'} />
            <FieldRow label="緊急度" value={<CircleUrgencyBadge level={caseData.urgency} />} />
          </>
        )}
      </div>
    </ScrollArea>
  );
}

/* ── Photo tab content ── */
function CasePhotoTab({ caseData }: { caseData: DummyCase }) {
  const photos = useMemo(() => {
    const linkedFacility = getDummyFacility(caseData.facilityRef);
    const categoryImages = linkedFacility?.category ? CATEGORY_IMAGES[linkedFacility.category] : undefined;
    return categoryImages ? categoryImages.map((f) => `/facilities/${f}`) : [];
  }, [caseData.facilityRef]);

  return <PreviewPhotoTab photos={photos} />;
}

/* ── Map tab content ── */
function CaseMapTab({ caseData }: { caseData: DummyCase }) {
  const { data: parkData, isLoading } = useGreenSpace(caseData.parkRef);
  const parkGeometry = parkData?.geometry ?? null;

  const facilityMarker = useMemo(() => {
    if (parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
      return [{ lng: c[0], lat: c[1] }];
    }
    return [];
  }, [parkGeometry]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#737373]">
        読み込み中...
      </div>
    );
  }

  if (!parkGeometry) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#737373]">
        地図データがありません
      </div>
    );
  }

  return (
    <div className="p-4 h-full">
      <MiniMap
        key={`case-${caseData.id}`}
        geometry={parkGeometry}
        markers={facilityMarker}
        height="100%"
        fillColor="#22C55E"
        focusOnMarkers={facilityMarker.length > 0}
      />
    </div>
  );
}

/* ── Main preview panel ── */
export function CasePreviewPanel({ caseData, onClose, onNavigateToDetail }: CasePreviewPanelProps) {
  return (
    <Tabs defaultValue="info" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#e5e5e5] px-5 shrink-0">
        <TabsList variant="line" className="h-auto gap-6 p-0">
          <TabsTrigger value="info" className="px-0 py-2 text-sm">情報</TabsTrigger>
          <TabsTrigger value="photos" className="px-0 py-2 text-sm">写真</TabsTrigger>
          <TabsTrigger value="map" className="px-0 py-2 text-sm">地図</TabsTrigger>
        </TabsList>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center border-none bg-transparent p-0 text-[#737373] hover:text-[#0a0a0a] hover:bg-transparent transition-colors cursor-pointer"
          aria-label="閉じる"
        >
          <X className="size-4" />
        </button>
      </div>

      <TabsContent value="info" className="flex-1 overflow-hidden mt-0">
        <CaseInfoTab caseData={caseData} onNavigateToDetail={onNavigateToDetail} />
      </TabsContent>

      <TabsContent value="photos" className="flex-1 mt-0 overflow-hidden">
        <CasePhotoTab caseData={caseData} />
      </TabsContent>

      <TabsContent value="map" className="flex-1 mt-0 overflow-hidden">
        <CaseMapTab caseData={caseData} />
      </TabsContent>
    </Tabs>
  );
}
