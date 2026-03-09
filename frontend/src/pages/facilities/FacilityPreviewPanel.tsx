import { useMemo } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MiniMap } from '@/components/MiniMap';
import { PreviewPhotoTab } from '@/components/preview/PreviewPhotoTab';
import { useNavigate } from 'react-router-dom';
import { useGreenSpace } from '../../hooks/useApi';
import { RankBadge } from '../../components/facility/RankBadge';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { CATEGORY_IMAGES } from '@/components/facility/FacilityPlaceholderImage';
import {
  type DummyFacility,
  FACILITY_CLASSIFICATION_LABELS,
  FACILITY_CATEGORY_LABELS,
  PARK_NAME_LOOKUP,
} from '../../data/dummyFacilities';
import { getDummyInspectionsByFacility, type DummyInspection } from '../../data/dummyInspections';
import { getDummyRepairsByFacility, type DummyRepair } from '../../data/dummyRepairs';
import * as turf from '@turf/turf';

interface FacilityPreviewPanelProps {
  facility: DummyFacility;
  onClose: () => void;
  onNavigateToDetail: () => void;
}

/* ── Style tokens (matching CasePreviewPanel / ParkPreviewPanel) ── */
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

/* ── Info tab ── */
function FacilityInfoTab({ facility, onNavigateToDetail }: { facility: DummyFacility; onNavigateToDetail: () => void }) {
  const navigate = useNavigate();
  const parkName = PARK_NAME_LOOKUP[facility.greenSpaceRef] || '-';
  const classificationLabel = facility.facilityClassification
    ? FACILITY_CLASSIFICATION_LABELS[facility.facilityClassification] || facility.facilityClassification
    : '-';

  return (
    <ScrollArea className="h-full">
      <div className="px-5 py-4">
        {/* 基本属性 */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-base font-normal leading-6 tracking-normal text-[#171717]">基本属性</span>
          <button
            type="button"
            onClick={onNavigateToDetail}
            className="inline-flex items-center gap-1 rounded-full border-none bg-[#215042] px-2.5 py-0.5 text-xs font-medium text-white hover:bg-[#2a6554] transition-colors cursor-pointer"
            data-testid="facility-detail-link-button"
          >
            施設詳細
            <ArrowRight className="size-3" />
          </button>
        </div>
        <FieldRow label="名称" value={facility.name} />
        <FieldRow label="状態" value={<StatusBadge status={facility.status} />} />
        <FieldRow label="施設ID" value={facility.facilityId} />
        <FieldRow label="施設分類" value={classificationLabel} />
        <FieldRow label="施設種別" value={FACILITY_CATEGORY_LABELS[facility.category] || facility.category} />
        <FieldRow
          label="公園名称"
          value={
            <button
              type="button"
              className="text-sm text-[#3b82f6] underline decoration-[#3b82f6]/40 hover:decoration-[#3b82f6] bg-transparent border-none p-0 cursor-pointer"
              onClick={() => navigate(`/assets/parks/${facility.greenSpaceRef}`)}
            >
              {parkName}
            </button>
          }
        />
        <FieldRow label="主要部材" value={facility.mainMaterial || facility.material} />
        <FieldRow label="数量" value={facility.quantity ? `${facility.quantity} 基` : '-'} />

        {/* 設置・施工情報 */}
        <p className={sectionTitleCls}>設置・施工情報</p>
        <FieldRow
          label="設置年"
          value={facility.dateInstalled ? new Date(facility.dateInstalled).toLocaleDateString('ja-JP') : '-'}
        />
        <FieldRow label="メーカー" value={facility.manufacturer || '-'} />
        <FieldRow label="設置業者" value={facility.installer || '-'} />

        {/* 維持管理・健全度 */}
        <p className={sectionTitleCls}>維持管理・健全度</p>
        <FieldRow
          label="最近点検日"
          value={facility.lastInspectionDate ? new Date(facility.lastInspectionDate).toLocaleDateString('ja-JP') : '-'}
        />
        <FieldRow label="構造ランク" value={facility.structureRank ? <RankBadge rank={facility.structureRank} /> : '-'} />
        <FieldRow label="消耗ランク" value={facility.wearRank ? <RankBadge rank={facility.wearRank} /> : '-'} />
        <FieldRow
          label="最近修理日"
          value={facility.lastRepairDate ? new Date(facility.lastRepairDate).toLocaleDateString('ja-JP') : '-'}
        />
      </div>
    </ScrollArea>
  );
}

/* ── Photo tab ── */
function FacilityPhotoTab({ facility }: { facility: DummyFacility }) {
  const photos = useMemo(() => {
    const categoryImages = CATEGORY_IMAGES[facility.category];
    return categoryImages ? categoryImages.map((f) => `/facilities/${f}`) : [];
  }, [facility.category]);

  return <PreviewPhotoTab photos={photos} />;
}

/* ── Map tab ── */
function FacilityMapTab({ facility }: { facility: DummyFacility }) {
  const { data: parkData, isLoading } = useGreenSpace(facility.greenSpaceRef);
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
        key={`facility-${facility.id}`}
        geometry={parkGeometry}
        markers={facilityMarker}
        height="100%"
        fillColor="#22C55E"
        focusOnMarkers={facilityMarker.length > 0}
      />
    </div>
  );
}

/* ── Inspection history tab ── */
function FacilityInspectionTab({ facility }: { facility: DummyFacility }) {
  const inspections = useMemo(() => getDummyInspectionsByFacility(facility.id), [facility.id]);

  if (inspections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#737373]">
        点検履歴データはありません
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-5 py-4 space-y-3">
        {inspections.map((insp: DummyInspection) => (
          <div key={insp.id} className="rounded-lg border border-[#f0f0f0] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#0a0a0a]">{new Date(insp.date).toLocaleDateString('ja-JP')}</span>
              <span className="text-xs text-[#737373]">ID: {insp.id}</span>
            </div>
            <FieldRow label="点検実施者" value={insp.inspector} />
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#737373]">構造</span>
                <RankBadge rank={insp.structureRank || '-'} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#737373]">消耗</span>
                <RankBadge rank={insp.wearRank || '-'} />
              </div>
            </div>
            {insp.structureMaterialNotes && insp.structureMaterialNotes !== '-' && (
              <p className="text-xs text-[#737373] mt-1">構造備考: {insp.structureMaterialNotes}</p>
            )}
            {insp.wearMaterialNotes && insp.wearMaterialNotes !== '-' && (
              <p className="text-xs text-[#737373] mt-1">消耗備考: {insp.wearMaterialNotes}</p>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/* ── Repair history tab ── */
function FacilityRepairTab({ facility }: { facility: DummyFacility }) {
  const repairs = useMemo(() => getDummyRepairsByFacility(facility.id), [facility.id]);

  if (repairs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#737373]">
        補修履歴データはありません
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-5 py-4 space-y-3">
        {repairs.map((rep: DummyRepair) => (
          <div key={rep.id} className="rounded-lg border border-[#f0f0f0] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#0a0a0a]">{new Date(rep.date).toLocaleDateString('ja-JP')}</span>
              <span className="text-xs text-[#737373]">ID: {rep.id}</span>
            </div>
            <FieldRow label="補修種別" value={rep.type} />
            <FieldRow label="補修内容" value={rep.description} />
            {rep.mainReplacementParts && <FieldRow label="主な交換部材" value={rep.mainReplacementParts} />}
            {rep.vendor && <FieldRow label="補修業者" value={rep.vendor} />}
            {rep.designDocNumber && <FieldRow label="設計書番号" value={rep.designDocNumber} />}
            {rep.repairNotes && <FieldRow label="備考" value={rep.repairNotes} />}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/* ── Main preview panel ── */
export function FacilityPreviewPanel({ facility, onClose, onNavigateToDetail }: FacilityPreviewPanelProps) {
  return (
    <Tabs defaultValue="info" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#e5e5e5] px-5 shrink-0">
        <TabsList variant="line" className="h-auto gap-4 p-0">
          <TabsTrigger value="info" className="px-0 py-2 text-sm">情報</TabsTrigger>
          <TabsTrigger value="photos" className="px-0 py-2 text-sm">写真</TabsTrigger>
          <TabsTrigger value="map" className="px-0 py-2 text-sm">地図</TabsTrigger>
          <TabsTrigger value="inspections" className="px-0 py-2 text-sm">点検履歴</TabsTrigger>
          <TabsTrigger value="repairs" className="px-0 py-2 text-sm">補修履歴</TabsTrigger>
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
        <FacilityInfoTab facility={facility} onNavigateToDetail={onNavigateToDetail} />
      </TabsContent>

      <TabsContent value="photos" className="flex-1 mt-0 overflow-hidden">
        <FacilityPhotoTab facility={facility} />
      </TabsContent>

      <TabsContent value="map" className="flex-1 mt-0 overflow-hidden">
        <FacilityMapTab facility={facility} />
      </TabsContent>

      <TabsContent value="inspections" className="flex-1 mt-0 overflow-hidden">
        <FacilityInspectionTab facility={facility} />
      </TabsContent>

      <TabsContent value="repairs" className="flex-1 mt-0 overflow-hidden">
        <FacilityRepairTab facility={facility} />
      </TabsContent>
    </Tabs>
  );
}
