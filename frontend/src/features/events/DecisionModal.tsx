import { Modal, Stack, Button, Text, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useSetPostEndDecision } from '../../hooks/useApi';

export function DecisionModal() {
  const { isDecisionModalOpen, decisionEventId, closeDecisionModal } = useUIStore();
  const setDecision = useSetPostEndDecision();

  const handleSetDecision = (decision: 'no-change' | 'permanent-change') => {
    if (!decisionEventId) return;
    setDecision.mutate(
      { id: decisionEventId, decision },
      { onSuccess: () => closeDecisionModal() }
    );
  };

  return (
    <Modal
      opened={isDecisionModalOpen}
      onClose={closeDecisionModal}
      title="Set Post-End Decision"
      centered
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
