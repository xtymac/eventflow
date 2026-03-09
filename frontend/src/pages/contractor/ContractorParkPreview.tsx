import { X } from 'lucide-react';
import { ParkFacilitiesTab } from '../parks/ParkPreviewPanel';
import type { CuratedPark } from '../../data/curatedParks';

interface ContractorParkPreviewProps {
  park: CuratedPark;
  onClose: () => void;
  onFacilityClick?: (facilityId: string, fromParkId?: string) => void;
}

export function ContractorParkPreview({ park, onClose, onFacilityClick }: ContractorParkPreviewProps) {
  return (
    <div className="flex h-full flex-col bg-background" data-testid="contractor-park-preview">
      {/* Header */}
      <div className="shrink-0 border-b border-[#e5e5e5] px-5 py-4">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-[#0a0a0a]">{park.displayName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center border-none bg-transparent p-0 text-[#737373] hover:text-[#0a0a0a] transition-colors"
            aria-label="閉じる"
            data-testid="contractor-park-preview-close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Compact info row */}
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-[#737373]">No</span>{' '}
            <span className="font-medium text-[#0a0a0a]">{park.no}</span>
          </span>
          <span>
            <span className="text-[#737373]">種別</span>{' '}
            <span className="font-medium text-[#0a0a0a]">{park.category}</span>
          </span>
          <span>
            <span className="text-[#737373]">行政区</span>{' '}
            <span className="font-medium text-[#0a0a0a]">{park.ward}</span>
          </span>
          <span className="basis-full">
            <span className="text-[#737373]">所在地</span>{' '}
            <span className="font-medium text-[#0a0a0a]">{park.address}</span>
          </span>
        </div>
      </div>

      {/* Facility list */}
      <div className="min-h-0 flex-1">
        <ParkFacilitiesTab
          parkId={park.id}
          parkName={park.displayName}
          onFacilityClick={onFacilityClick ? (fId) => onFacilityClick(fId, park.id) : undefined}
        />
      </div>
    </div>
  );
}
