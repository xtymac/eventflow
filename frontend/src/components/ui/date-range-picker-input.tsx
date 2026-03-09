import { useState, forwardRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DateRangePickerInputProps {
  label?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  clearable?: boolean;
  error?: string;
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  popoverProps?: { zIndex?: number };
  className?: string;
}

function formatRange(range: DateRange | undefined): string {
  if (!range) return '';
  const from = range.from ? format(range.from, 'yyyy/MM/dd') : '';
  const to = range.to ? format(range.to, 'yyyy/MM/dd') : '';
  if (from && to) return `${from} 〜 ${to}`;
  if (from) return `${from} 〜`;
  return '';
}

export const DateRangePickerInput = forwardRef<HTMLDivElement, DateRangePickerInputProps>(
  function DateRangePickerInput(
    { label, placeholder = '日付を選択', description, required, clearable, error, value, onChange, popoverProps, className },
    ref
  ) {
    const [open, setOpen] = useState(false);

    const hasValue = value?.from || value?.to;
    const rangeText = formatRange(value);

    const trigger = (
      <div className="relative">
        <PopoverTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); }}
          >
            <Input
              readOnly
              value={rangeText}
              placeholder={placeholder}
              className={cn(
                'cursor-pointer text-xs pr-9',
                error && 'border-destructive',
              )}
            />
          </div>
        </PopoverTrigger>
        {clearable && hasValue ? (
          <span
            role="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center cursor-pointer text-muted-foreground/60 hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
          >
            <X className="size-4" />
          </span>
        ) : (
          <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
    );

    return (
      <div ref={ref} className={cn('flex flex-col gap-1', className)}>
        {label && (
          <Label className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip open={rangeText && !open ? undefined : false}>
            <TooltipTrigger asChild>
              {trigger}
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">
              {rangeText}
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            className="w-auto p-0"
            align="start"
            style={popoverProps?.zIndex ? { zIndex: popoverProps.zIndex } : undefined}
          >
            <Calendar
              mode="range"
              selected={value}
              onSelect={onChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  },
);
