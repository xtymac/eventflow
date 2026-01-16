/**
 * Import Wizard Component
 *
 * Step-by-step wizard for importing GeoPackage/GeoJSON files:
 * Upload → Configure → Review → Publish
 */

import { Modal, Stepper, Group, Button, Stack } from '@mantine/core';
import { IconUpload, IconSettings, IconEye, IconRocket } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { UploadStep } from './steps/UploadStep';
import { ConfigureStep } from './steps/ConfigureStep';
import { ReviewStep } from './steps/ReviewStep';
import { PublishStep } from './steps/PublishStep';

const STEP_ORDER: Array<'upload' | 'configure' | 'review' | 'publish'> = [
  'upload',
  'configure',
  'review',
  'publish',
];

function getStepIndex(step: typeof STEP_ORDER[number]): number {
  return STEP_ORDER.indexOf(step);
}

export function ImportWizard() {
  const {
    importWizardOpen,
    importWizardStep,
    closeImportWizard,
    setImportWizardStep,
  } = useUIStore();

  const currentStepIndex = getStepIndex(importWizardStep);

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setImportWizardStep(STEP_ORDER[currentStepIndex - 1]);
    }
  };

  const handleClose = () => {
    closeImportWizard();
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
    <Modal
      opened={importWizardOpen}
      onClose={handleClose}
      title="Import GeoPackage / GeoJSON"
      size="xl"
      padding="lg"
      closeOnClickOutside={false}
    >
      <Stack gap="lg">
        <Stepper
          active={currentStepIndex}
          size="sm"
          allowNextStepsSelect={false}
        >
          <Stepper.Step
            label="Upload"
            description="Select file"
            icon={<IconUpload size={18} />}
          />
          <Stepper.Step
            label="Configure"
            description="Set options"
            icon={<IconSettings size={18} />}
          />
          <Stepper.Step
            label="Review"
            description="Check changes"
            icon={<IconEye size={18} />}
          />
          <Stepper.Step
            label="Publish"
            description="Apply changes"
            icon={<IconRocket size={18} />}
          />
        </Stepper>

        <div style={{ minHeight: 300 }}>
          {renderStepContent()}
        </div>

        <Group justify="space-between">
          <Button
            variant="subtle"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
          >
            Back
          </Button>
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
