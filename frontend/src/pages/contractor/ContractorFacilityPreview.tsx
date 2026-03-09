import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowLeft, ClipboardCheck, Wrench } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useParkFacility } from '../../hooks/useApi';
import {
  getDummyFacility,
  getDummyFacilitiesByPark,
  FACILITY_CATEGORY_LABELS,
  FACILITY_CLASSIFICATION_LABELS,
  PARK_NAME_LOOKUP,
} from '../../data/dummyFacilities';
import { CATEGORY_IMAGES } from '../../components/facility/FacilityPlaceholderImage';
import { StatusBadge } from '../../components/facility/StatusBadge';
import { RankBadge } from '../../components/facility/RankBadge';

interface ContractorFacilityPreviewProps {
  facilityId: string;
  onClose: () => void;
  onBack?: () => void;
  onNavigateToPark?: (parkId: string) => void;
  onOpenInspectionForm?: () => void;
  onOpenRepairForm?: () => void;
}

const fieldRowCls = 'flex items-start justify-between py-2.5 border-b border-[#f5f5f5] text-sm';
const fieldLabelCls = 'text-[#737373] shrink-0 text-xs leading-5';
const fieldValueCls = 'text-right text-[#0a0a0a] ml-4 font-medium text-sm leading-5';
const sectionTitleCls = 'text-sm font-semibold text-[#0a0a0a] mt-5 mb-1';

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  const display = value === null || value === undefined || value === '' ? '-' : value;
  return (
    <div className={fieldRowCls}>
      <span className={fieldLabelCls}>{label}</span>
      <span className={fieldValueCls}>{display}</span>
    </div>
  );
}

export function ContractorFacilityPreview({
  facilityId,
  onClose,
  onBack,
  onNavigateToPark,
  onOpenInspectionForm,
  onOpenRepairForm,
}: ContractorFacilityPreviewProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useParkFacility(facilityId);
  const apiFacility = data?.properties;

  // Try richer dummy data: first exact ID match, then match by name+park
  const dummyDirect = getDummyFacility(facilityId);
  const dummyByMatch = !dummyDirect && apiFacility
    ? getDummyFacilitiesByPark(apiFacility.greenSpaceRef).find(
        (f) => f.name === apiFacility.name,
      )
    : null;
  const dummyFacility = dummyDirect || dummyByMatch;

  // Merge: prefer richer dummy data, fall back to API data
  const facility: Record<string, any> | null = dummyFacility
    ? { ...apiFacility, ...dummyFacility }
    : apiFacility
      ? { ...apiFacility }
      : null;

  const [photoIndex, setPhotoIndex] = useState(0);

  if (isLoading && !facility) {
    return (
      <div
        className="flex h-full flex-col bg-background"
        data-testid="contractor-facility-preview"
      >
        <div className="flex h-full items-center justify-center text-sm text-[#737373]">
          読み込み中...
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div
        className="flex h-full flex-col bg-background"
        data-testid="contractor-facility-preview"
      >
        <div className="shrink-0 border-b border-[#e5e5e5] px-5 py-4">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-bold text-[#0a0a0a]">施設詳細</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 shrink-0 items-center justify-center border-none bg-transparent p-0 text-[#737373] hover:text-[#0a0a0a] transition-colors"
              aria-label="閉じる"
              data-testid="contractor-facility-preview-close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-[#737373]">
          施設データが見つかりません
        </div>
      </div>
    );
  }

  const parkName = facility.greenSpaceRef
    ? PARK_NAME_LOOKUP[facility.greenSpaceRef] ?? null
    : null;

  const categoryLabel =
    FACILITY_CATEGORY_LABELS[facility.category] ||
    facility.subCategory ||
    facility.category ||
    '-';
  const classificationLabel = facility.facilityClassification
    ? FACILITY_CLASSIFICATION_LABELS[facility.facilityClassification] ||
      facility.facilityClassification
    : '-';

  const images = facility.category
    ? CATEGORY_IMAGES[facility.category]
    : undefined;
  const imageCount = images?.length ?? 0;
  const currentImage = images?.[photoIndex % (imageCount || 1)];

  return (
    <div
      className="flex h-full flex-col bg-background"
      data-testid="contractor-facility-preview"
    >
      {/* Header */}
      <div className="shrink-0 border-b border-[#e5e5e5] px-5 py-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 flex items-center gap-1 border-none bg-transparent p-0 text-sm text-[#737373] hover:text-[#0a0a0a] transition-colors cursor-pointer"
            data-testid="contractor-facility-preview-back"
          >
            <ArrowLeft className="size-4" />
            <span>戻る</span>
          </button>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[#0a0a0a] truncate">
              {facility.name}
            </h2>
            <div className="mt-1.5 flex items-center gap-2">
              <StatusBadge status={facility.status} />
              <span className="text-xs text-[#737373]">
                {facility.facilityId}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center border-none bg-transparent p-0 text-[#737373] hover:text-[#0a0a0a] transition-colors"
            aria-label="閉じる"
            data-testid="contractor-facility-preview-close"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-5 py-4">
          {/* Photo */}
          <div className="relative rounded-lg overflow-hidden h-[200px] mb-4">
            {currentImage ? (
              <img
                src={`/facilities/${currentImage}`}
                alt={facility.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-[#f5f5f5] flex items-center justify-center">
                <span className="text-sm text-[#a3a3a3]">画像なし</span>
              </div>
            )}
            {imageCount > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 size-7 rounded-full bg-white/80 border-0 shadow-md hover:bg-white"
                  aria-label="前の画像"
                  onClick={() =>
                    setPhotoIndex(
                      (i) => (i - 1 + imageCount) % imageCount,
                    )
                  }
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8.64645 2.64645C8.84171 2.45118 9.15829 2.45118 9.35355 2.64645C9.54882 2.84171 9.54882 3.15829 9.35355 3.35355L5.70711 7L9.35355 10.6464C9.54882 10.8417 9.54882 11.1583 9.35355 11.3536C9.15829 11.5488 8.84171 11.5488 8.64645 11.3536L4.64645 7.35355C4.45118 7.15829 4.45118 6.84171 4.64645 6.64645L8.64645 2.64645Z"
                      fill="#0A0A0A"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-full bg-white/80 border-0 shadow-md hover:bg-white"
                  aria-label="次の画像"
                  onClick={() =>
                    setPhotoIndex((i) => (i + 1) % imageCount)
                  }
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5.35355 2.64645C5.15829 2.45118 4.84171 2.45118 4.64645 2.64645C4.45118 2.84171 4.45118 3.15829 4.64645 3.35355L8.29289 7L4.64645 10.6464C4.45118 10.8417 4.45118 11.1583 4.64645 11.3536C4.84171 11.5488 5.15829 11.5488 5.35355 11.3536L9.35355 7.35355C9.54882 7.15829 9.54882 6.84171 9.35355 6.64645L5.35355 2.64645Z"
                      fill="#0A0A0A"
                    />
                  </svg>
                </Button>
              </>
            )}
          </div>

          {/* Basic info */}
          <p className={sectionTitleCls}>基本情報</p>
          <FieldRow label="名称" value={facility.name} />
          <FieldRow label="施設ID" value={facility.facilityId} />
          <FieldRow label="施設分類" value={classificationLabel} />
          <FieldRow label="施設種別" value={categoryLabel} />
          {parkName && (
            <FieldRow
              label="公園名称"
              value={
                onNavigateToPark && facility.greenSpaceRef ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-[#215042] underline underline-offset-2 hover:text-[#2a6554] border-none bg-transparent p-0 cursor-pointer transition-colors"
                    onClick={() => onNavigateToPark(facility.greenSpaceRef)}
                  >
                    {parkName}
                  </button>
                ) : (
                  parkName
                )
              }
            />
          )}
          <FieldRow label="行政区" value={facility.ward} />
          <FieldRow
            label="主要部材"
            value={facility.mainMaterial || facility.material}
          />
          <FieldRow
            label="数量"
            value={
              facility.quantity ? `${facility.quantity} 基` : undefined
            }
          />

          {/* Installation info */}
          <p className={sectionTitleCls}>設置・施工情報</p>
          <FieldRow
            label="設置年"
            value={
              facility.dateInstalled
                ? new Date(facility.dateInstalled).toLocaleDateString(
                    'ja-JP',
                  )
                : undefined
            }
          />
          <FieldRow label="メーカー" value={facility.manufacturer} />
          <FieldRow label="設置業者" value={facility.installer} />
          <FieldRow label="設計書番号" value={facility.designDocNumber} />

          {/* Condition */}
          <p className={sectionTitleCls}>維持管理・健全度</p>
          <FieldRow
            label="構造ランク"
            value={
              facility.structureRank ? (
                <RankBadge rank={facility.structureRank} />
              ) : facility.conditionGrade ? (
                <RankBadge rank={facility.conditionGrade} />
              ) : undefined
            }
          />
          <FieldRow
            label="消耗ランク"
            value={
              facility.wearRank ? (
                <RankBadge rank={facility.wearRank} />
              ) : undefined
            }
          />
          <FieldRow
            label="最近点検日"
            value={
              facility.lastInspectionDate
                ? new Date(
                    facility.lastInspectionDate,
                  ).toLocaleDateString('ja-JP')
                : undefined
            }
          />
          <FieldRow
            label="直近修理日"
            value={
              facility.lastRepairDate
                ? new Date(
                    facility.lastRepairDate,
                  ).toLocaleDateString('ja-JP')
                : undefined
            }
          />

          {/* Notes */}
          {facility.notes && (
            <>
              <p className={sectionTitleCls}>備考</p>
              <p className="text-sm text-[#0a0a0a] leading-relaxed whitespace-pre-line">
                {facility.notes}
              </p>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Action buttons — sticky footer */}
      <div className="shrink-0 border-t border-[#e5e5e5] px-5 py-4 flex gap-3" data-testid="contractor-facility-actions">
        <Button
          className="flex-1 gap-2"
          onClick={() => onOpenInspectionForm ? onOpenInspectionForm() : navigate('/contractor/inspections')}
          data-testid="contractor-facility-action-inspection"
        >
          <ClipboardCheck className="size-4" />
          点検記録
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => onOpenRepairForm ? onOpenRepairForm() : navigate('/contractor/repairs')}
          data-testid="contractor-facility-action-repair"
        >
          <Wrench className="size-4" />
          修繕記録
        </Button>
      </div>
    </div>
  );
}
