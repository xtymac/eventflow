import { useState, forwardRef } from 'react';
import { format } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import 'react-day-picker/style.css';

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
}

export const DatePickerInput = forwardRef<HTMLButtonElement, DatePickerInputProps>(
  function DatePickerInput(
    { label, placeholder = 'Select date', description, required, clearable, error, value, onChange, popoverProps },
    ref
  ) {
    const [open, setOpen] = useState(false);

    return (
      <div className="flex flex-col gap-1">
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
              <Button
                ref={ref}
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !value && 'text-muted-foreground',
                  error && 'border-destructive'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(value, 'yyyy/MM/dd') : placeholder}
              </Button>
            </PopoverTrigger>
            {clearable && value && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
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
            <DayPicker
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
