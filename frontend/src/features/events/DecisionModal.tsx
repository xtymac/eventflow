import { Modal, Stack, Button, Text, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useSetPostEndDecision, useArchiveEvent } from '../../hooks/useApi';

export function DecisionModal() {
  const { isDecisionModalOpen, decisionEventId, closeDecisionModal, enterRoadUpdateMode } = useUIStore();
  const setDecision = useSetPostEndDecision();
  const archiveEvent = useArchiveEvent();

  const handleSetDecision = (decision: 'no-change' | 'permanent-change') => {
    if (!decisionEventId) return;
    setDecision.mutate(
      { id: decisionEventId, decision },
      {
        onSuccess: () => {
          closeDecisionModal();

          if (decision === 'no-change') {
            // Archive immediately for "No Change"
            archiveEvent.mutate(decisionEventId, {
              onSuccess: () => {
                notifications.show({
                  title: 'Event Archived',
                  message: 'Event marked as "No Change" and archived.',
                  color: 'green',
                });
              },
            });
          } else {
            // Enter road update mode for "Permanent Change"
            enterRoadUpdateMode(decisionEventId);
          }
        },
      }
    );
  };

  return (
    <Modal
      opened={isDecisionModalOpen}
      onClose={closeDecisionModal}
      title="Set Post-End Decision"
      centered
      zIndex={300}
    >
      {!decisionEventId ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          No event selected. Please close and try again.
        </Alert>
      ) : (
        <Stack gap="md">
          <Text size="sm">
            The event has ended. Please select the outcome:
          </Text>
          <Button
            fullWidth
            variant="light"
            onClick={() => handleSetDecision('no-change')}
            loading={setDecision.isPending}
          >
            No Change
          </Button>
          <Button
            fullWidth
            color="green"
            onClick={() => handleSetDecision('permanent-change')}
            loading={setDecision.isPending}
          >
            Permanent Change
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
