/**
 * Import Wizard Component
 *
 * Step-by-step wizard for importing GeoPackage/GeoJSON files:
 * Upload -> Configure -> Review -> Publish
 */

import { Stack } from '@/components/shims';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Stepper } from '@/components/ui/stepper';
import { IconUpload, IconSettings, IconEye, IconRocket } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { UploadStep } from './steps/UploadStep';
import { ConfigureStep } from './steps/ConfigureStep';
import { ReviewStep } from './steps/ReviewStep';
import { PublishStep } from './steps/PublishStep';

type WizardStep = 'upload' | 'configure' | 'review' | 'publish';

const STEP_CONFIG: Record<WizardStep, { label: string; description: string; icon: React.ReactNode }> = {
  upload: { label: 'Upload', description: 'Select file', icon: <IconUpload size={18} /> },
  configure: { label: 'Configure', description: 'Set options', icon: <IconSettings size={18} /> },
  review: { label: 'Review', description: 'Check changes', icon: <IconEye size={18} /> },
  publish: { label: 'Publish', description: 'Apply changes', icon: <IconRocket size={18} /> },
};

export function ImportWizard() {
  const {
    importWizardOpen,
    importWizardStep,
    importHasReviewStep,
    closeImportWizard,
    setImportWizardStep,
  } = useUIStore();

  // Single source of truth for step order
  const stepOrder: WizardStep[] = importHasReviewStep
    ? ['upload', 'configure', 'review', 'publish']
    : ['upload', 'configure', 'publish'];

  const currentStepIndex = stepOrder.indexOf(importWizardStep);

  const handleClose = () => {
    closeImportWizard();
  };

  // Handle step click - only allow navigating to previous/completed steps
  const handleStepClick = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) {
      setImportWizardStep(stepOrder[stepIndex]);
    }
  };

  const renderStepContent = () => {
    switch (importWizardStep) {
      case 'upload':
        return <UploadStep />;
      case 'configure':
        return <ConfigureStep />;
      case 'review':
        return <ReviewStep />;
      case 'publish':
        return <PublishStep />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={importWizardOpen} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Import GeoPackage / GeoJSON</DialogTitle>
        </DialogHeader>
        <Stack gap="lg">
          <Stepper
            active={currentStepIndex}
            size="sm"
            onStepClick={handleStepClick}
          >
            {stepOrder.map((step) => (
              <Stepper.Step
                key={step}
                label={STEP_CONFIG[step].label}
                description={STEP_CONFIG[step].description}
                icon={STEP_CONFIG[step].icon}
              />
            ))}
          </Stepper>

          <div style={{ minHeight: 300 }}>
            {renderStepContent()}
          </div>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
