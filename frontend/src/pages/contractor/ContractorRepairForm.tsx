import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DUMMY_PARK_FACILITIES } from '../../data/dummyParkFacilities';
import { useCreateRepair, useUpdateRepair } from '../../hooks/useApi';
import { showNotification } from '../../lib/toast';
import { useAuth } from '../../contexts/AuthContext';
import { compressImageToDataUrl, MAX_PHOTOS_PER_CASE } from '../../utils/compressImage';

interface RepairFormData {
  inspectionDate: string;
  inspector: string;
  mainMaterial: string;
  repairContent: string;
  repairNotes: string;
  designDocNumber: string;
}

interface ContractorRepairFormProps {
  facilityId: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  /** When provided, the form operates in edit mode */
  recordId?: string | number;
  initialData?: {
    inspectionDate?: string; // maps to repairDate
    inspector?: string;
    mainMaterial?: string;
    repairContent?: string;
    repairNotes?: string;
    designDocNumber?: string;
  };
}

const MATERIAL_OPTIONS = [
  'スチール',
  'ステンレス',
  '金属(ステンレス以外)',
  'コンクリート',
  'RC',
  '石材',
  '樹脂',
];

/* ── Photo thumbnail ── */
function PhotoThumbnail({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [src, setSrc] = useState<string>('');
  const reader = new FileReader();
  reader.onload = (e) => setSrc(e.target?.result as string);
  if (!src) reader.readAsDataURL(file);

  return (
    <div className="relative group size-[72px] rounded-md overflow-hidden border border-[#e5e5e5]">
      {src ? (
        <img src={src} alt={file.name} className="size-full object-cover" />
      ) : (
        <div className="size-full bg-[#f5f5f5] animate-pulse" />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#0a0a0a]/70 text-white border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="削除"
        data-testid="photo-remove-btn"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export function ContractorRepairForm({
  facilityId,
  open,
  onClose,
  onSubmitted,
  recordId,
  initialData,
}: ContractorRepairFormProps) {
  const isEditMode = recordId != null;
  const today = new Date().toISOString().slice(0, 10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const { user, isAuthenticated } = useAuth();
  const inspectorName = user?.name || '株式会社〇〇';
  const createRepair = useCreateRepair();
  const updateRepair = useUpdateRepair();

  const { control, handleSubmit, reset } = useForm<RepairFormData>({
    defaultValues: {
      inspectionDate: initialData?.inspectionDate || today,
      inspector: initialData?.inspector || inspectorName,
      mainMaterial: initialData?.mainMaterial || '',
      repairContent: initialData?.repairContent || '',
      repairNotes: initialData?.repairNotes || '',
      designDocNumber: initialData?.designDocNumber || '',
    },
  });

  const handleSave = async (data: RepairFormData, status: 'draft' | 'submitted') => {
    if (!isAuthenticated) {
      showNotification({
        title: 'ログインが必要です',
        message: 'レコードを作成するにはログインしてください。',
        color: 'red',
      });
      return;
    }

    let mediaUrls: string[] | undefined;
    if (photos.length > 0) {
      try {
        mediaUrls = await Promise.all(
          photos.slice(0, MAX_PHOTOS_PER_CASE).map((f) => compressImageToDataUrl(f)),
        );
      } catch (err) {
        showNotification({
          title: '写真の圧縮に失敗しました',
          message: err instanceof Error ? err.message : '写真を小さくしてください',
          color: 'red',
        });
        return;
      }
    }

    const geoFeature = DUMMY_PARK_FACILITIES.find((f) => f.properties.id === facilityId);
    const geometry = geoFeature?.geometry as { type: 'Point'; coordinates: [number, number] } | undefined;
    const fallbackGeometry = { type: 'Point' as const, coordinates: [136.933, 35.140] as [number, number] };

    try {
      if (isEditMode) {
        await updateRepair.mutateAsync({
          id: String(recordId),
          data: {
            repairDate: data.inspectionDate,
            repairType: data.repairContent || '消耗部材交換',
            description: data.repairContent || undefined,
            mainReplacementParts: data.mainMaterial || undefined,
            repairNotes: data.repairNotes || undefined,
            designDocNumber: data.designDocNumber || undefined,
            vendor: data.inspector,
            ...(mediaUrls ? { mediaUrls } : {}),
            status,
          },
        });
      } else {
        await createRepair.mutateAsync({
          assetType: 'park-facility',
          assetId: facilityId,
          repairDate: data.inspectionDate,
          repairType: data.repairContent || '消耗部材交換',
          description: data.repairContent || undefined,
          mainReplacementParts: data.mainMaterial || undefined,
          repairNotes: data.repairNotes || undefined,
          designDocNumber: data.designDocNumber || undefined,
          vendor: data.inspector,
          geometry: geometry ?? fallbackGeometry,
          mediaUrls,
          status,
        });
      }
    } catch {
      showNotification({
        title: 'DB保存に失敗しました',
        message: 'サーバーへの保存に失敗しました。',
        color: 'red',
      });
      return;
    }

    const msg = status === 'draft'
      ? { title: '下書きを保存しました', message: `${data.repairContent || '消耗部材交換'} — ${data.inspectionDate}`, color: 'blue' as const }
      : { title: isEditMode ? '修理記録を更新しました' : '修理記録を保存しました', message: `${data.repairContent || '消耗部材交換'} — ${data.inspectionDate}`, color: 'green' as const };
    showNotification(msg);
    onSubmitted();
  };

  const onSubmit = (data: RepairFormData) => handleSave(data, 'submitted');
  const onDraft = () => handleSubmit((data) => handleSave(data, 'draft'))();

  const handleClearAll = () => {
    reset({
      inspectionDate: initialData?.inspectionDate || today,
      inspector: initialData?.inspector || inspectorName,
      mainMaterial: initialData?.mainMaterial || '',
      repairContent: initialData?.repairContent || '',
      repairNotes: initialData?.repairNotes || '',
      designDocNumber: initialData?.designDocNumber || '',
    });
    setPhotos([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files).filter((f) => f.size <= 5 * 1024 * 1024);
    setPhotos((prev) => [...prev, ...newFiles].slice(0, MAX_PHOTOS_PER_CASE));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        data-testid="contractor-repair-backdrop"
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background shadow-lg"
        data-testid="contractor-repair-form"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="text-xl font-medium text-[#0a0a0a]">{isEditMode ? '修理を編集' : '修理'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-6 shrink-0 items-center justify-center border-none bg-transparent p-0 text-[#737373] hover:text-[#0a0a0a] transition-colors"
            aria-label="閉じる"
            data-testid="contractor-repair-form-close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form body */}
        <form
          id="contractor-repair-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-2 px-4 pb-4"
        >
          {/* Row 1: Date | Inspector */}
          <div className="grid grid-cols-2 gap-7">
            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium text-[#0a0a0a]">
                補修年月日
              </Label>
              <Controller
                name="inspectionDate"
                control={control}
                render={({ field }) => (
                  <input
                    type="date"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    className="h-9 w-full rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm shadow-xs"
                    data-testid="repair-date-input"
                  />
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium text-[#0a0a0a]">
                点検実施者
              </Label>
              <Controller
                name="inspector"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled
                  >
                    <SelectTrigger
                      className="w-full opacity-50"
                      data-testid="repair-inspector-input"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={inspectorName}>{inspectorName}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Row 2: Main Material | Design Doc Number */}
          <div className="grid grid-cols-2 gap-7">
            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium text-[#0a0a0a]">
                主要部材
              </Label>
              <Controller
                name="mainMaterial"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      className="w-full"
                      data-testid="repair-material-select"
                    >
                      <SelectValue placeholder=" " />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium text-[#0a0a0a]">
                設計書番号
              </Label>
              <Controller
                name="designDocNumber"
                control={control}
                render={({ field }) => (
                  <input
                    type="text"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    data-testid="repair-design-doc-input"
                  />
                )}
              />
            </div>
          </div>

          {/* Row 3: Repair Content | Repair Notes */}
          <div className="grid grid-cols-2 gap-7">
            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium text-[#0a0a0a]">
                補修内容
              </Label>
              <Controller
                name="repairContent"
                control={control}
                render={({ field }) => (
                  <textarea
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[100px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none"
                    data-testid="repair-content-textarea"
                  />
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium text-[#0a0a0a]">
                補修備考
              </Label>
              <Controller
                name="repairNotes"
                control={control}
                render={({ field }) => (
                  <textarea
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[100px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none"
                    data-testid="repair-notes-textarea"
                  />
                )}
              />
            </div>
          </div>

          {/* Row 4: Photo upload with thumbnails */}
          <div className="flex flex-col gap-1 w-1/2 pr-3.5">
            <Label className="text-sm font-medium text-[#0a0a0a]">
              写真
            </Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-full items-center rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm shadow-xs gap-2 cursor-pointer"
              data-testid="repair-photo-upload"
            >
              <span className="flex-1 text-left text-[#737373] truncate">
                ファイルアップロード（最大5MB）
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[#737373]">
                <path d="M14 10v2.667A1.333 1.333 0 0 1 12.667 14H3.333A1.333 1.333 0 0 1 2 12.667V10M11.333 5.333 8 2m0 0L4.667 5.333M8 2v8" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              data-testid="repair-photo-file-input"
            />
          </div>

          {/* Photo thumbnails */}
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1" data-testid="repair-photo-thumbnails">
              {photos.map((file, i) => (
                <PhotoThumbnail
                  key={`${file.name}-${i}`}
                  file={file}
                  onRemove={() => removePhoto(i)}
                />
              ))}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e5e5e5] px-4 py-3">
          <Button
            type="button"
            variant="link"
            className="text-[#737373] px-0"
            onClick={handleClearAll}
            data-testid="contractor-repair-clear"
          >
            すべてクリア
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onDraft}
              data-testid="contractor-repair-draft"
            >
              下書き保存
            </Button>
            <Button
              type="submit"
              form="contractor-repair-form"
              data-testid="contractor-repair-submit"
            >
              提出
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
