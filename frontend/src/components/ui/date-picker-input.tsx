import { useState, forwardRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerInputProps {
  label?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  clearable?: boolean;
  error?: string;
  value: Date | null | undefined;
  onChange: (date: Date | null) => void;
  popoverProps?: { zIndex?: number };
  className?: string;
}

export const DatePickerInput = forwardRef<HTMLDivElement, DatePickerInputProps>(
  function DatePickerInput(
    { label, placeholder = 'Select date', description, required, clearable, error, value, onChange, popoverProps, className },
    ref
  ) {
    const [open, setOpen] = useState(false);

    return (
      <div ref={ref} className={cn("flex flex-col gap-1", className)}>
        {label && (
          <Label className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <Popover open={open} onOpenChange={setOpen}>
          <div className="relative">
            <PopoverTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); }}
              >
                <Input
                  readOnly
                  value={value ? format(value, 'yyyy/MM/dd') : ''}
                  placeholder={placeholder}
                  className={cn(
                    'cursor-pointer pr-9',
                    error && 'border-destructive'
                  )}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </PopoverTrigger>
            {clearable && value && (
              <button
                type="button"
                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <PopoverContent
            className="w-auto p-0"
            align="start"
            style={popoverProps?.zIndex ? { zIndex: popoverProps.zIndex } : undefined}
          >
            <Calendar
              mode="single"
              selected={value ?? undefined}
              onSelect={(date) => {
                onChange(date ?? null);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
