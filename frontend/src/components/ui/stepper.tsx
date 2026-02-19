import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepConfig {
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface StepperProps {
  active: number;
  size?: 'sm' | 'md';
  onStepClick?: (index: number) => void;
  children: ReactNode;
}

interface StepProps {
  label: string;
  description?: string;
  icon?: ReactNode;
}

function Step(_props: StepProps) {
  // This is a declarative-only component — rendering is handled by Stepper parent
  return null;
}

function Stepper({ active, onStepClick, children }: StepperProps) {
  // Extract step configs from children
  const steps: StepConfig[] = [];
  const childArray = Array.isArray(children) ? children : [children];
  childArray.forEach((child) => {
    if (child && typeof child === 'object' && 'props' in child) {
      steps.push({
        label: child.props.label,
        description: child.props.description,
        icon: child.props.icon,
      });
    }
  });

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const isCompleted = index < active;
        const isActive = index === active;
        const isClickable = onStepClick && index <= active;

        return (
          <div key={index} className="flex items-center gap-1 flex-1 last:flex-none">
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors',
                isClickable ? 'cursor-pointer hover:bg-accent' : 'cursor-default',
                isActive && 'font-medium text-primary',
                isCompleted && 'text-muted-foreground',
                !isActive && !isCompleted && 'text-muted-foreground/50'
              )}
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
            >
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && 'bg-primary/20 text-primary',
                  !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : step.icon ? (
                  step.icon
                ) : (
                  index + 1
                )}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs leading-tight">{step.label}</div>
                {step.description && (
                  <div className="text-[10px] leading-tight text-muted-foreground">
                    {step.description}
                  </div>
                )}
              </div>
            </button>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1 mx-1',
                  index < active ? 'bg-primary/40' : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

Stepper.Step = Step;

export { Stepper };
export type { StepperProps, StepProps };
