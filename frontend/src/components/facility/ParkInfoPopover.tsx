import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CuratedPark } from '../../data/curatedParks';

interface ParkInfoPopoverProps {
  park: CuratedPark;
  children: React.ReactNode;
}

export function ParkInfoPopover({ park, children }: ParkInfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[260px] rounded-lg border border-[#e5e5e5] p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#f5f5f5] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-[#0a0a0a]">{park.displayName}</span>
            <Link
              to={`/assets/parks/${park.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
        <div className="space-y-1.5 px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#737373]">No</span>
            <span className="text-[#0a0a0a]">{park.no}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#737373]">区</span>
            <span className="text-[#0a0a0a]">{park.ward}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="shrink-0 text-[#737373]">所在地</span>
            <span className="text-right text-[#0a0a0a]">{park.address}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
