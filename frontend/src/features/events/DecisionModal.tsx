import { useState } from 'react';
import { Modal, Stack, Button, Text, Alert, Textarea, Select, Group, Divider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useCloseEvent, useWorkOrders, useEvent } from '../../hooks/useApi';

// Temporary Gov role options (Phase 3 will have proper RBAC)
const GOV_ROLE_OPTIONS = [
  { value: 'gov_admin', label: 'Gov Admin' },
  { value: 'gov_event_ops', label: 'Gov Event Ops' },
];

export function DecisionModal() {
  const { isDecisionModalOpen, decisionEventId, closeDecisionModal } = useUIStore();
  const closeEvent = useCloseEvent();

  // Fetch event to check status
  const { data: eventData } = useEvent(decisionEventId);
  const event = eventData?.data;

  // Fetch workorders to check completion status
  const { data: workOrdersData } = useWorkOrders(decisionEventId || undefined);
  const workOrders = workOrdersData?.data || [];

  // State for close form
  const [closeNotes, setCloseNotes] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>('gov_admin');

  // Check if all work orders are completed/cancelled
  const incompleteWorkOrders = workOrders.filter(
    wo => wo.status !== 'completed' && wo.status !== 'cancelled'
  );
  const hasIncompleteWorkOrders = incompleteWorkOrders.length > 0;

  const isPendingReview = event?.status === 'pending_review';

  // Reset form when modal closes
  const handleClose = () => {
    setCloseNotes('');
    setSelectedRole('gov_admin');
    closeDecisionModal();
  };

  // Close event flow for pending_review status
  const handleCloseEvent = () => {
    if (!decisionEventId || !selectedRole) return;

    closeEvent.mutate(
      {
        id: decisionEventId,
        data: {
          closeNotes: closeNotes || undefined,
        },
        userRole: selectedRole,
      },
      {
        onSuccess: () => {
          handleClose();
          notifications.show({
            title: 'Event Closed',
            message: 'Event closed successfully.',
            color: 'green',
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Close Failed',
            message: error instanceof Error ? error.message : 'Failed to close event',
            color: 'red',
          });
        },
      }
    );
  };

  return (
    <Modal
      opened={isDecisionModalOpen}
      onClose={handleClose}
      title="Close Event"
      centered
      zIndex={300}
      size="md"
    >
      {!decisionEventId ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          No event selected. Please close and try again.
        </Alert>
      ) : isPendingReview ? (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Review the event and confirm closure. Gov role required.
          </Text>

          {/* Work Orders Status */}
          {workOrders.length > 0 && (
            <Alert
              color={hasIncompleteWorkOrders ? 'yellow' : 'green'}
              icon={hasIncompleteWorkOrders ? <IconAlertCircle size={16} /> : <IconCheck size={16} />}
            >
              <Group gap="xs">
                <Text size="sm" fw={500}>
                  Work Orders: {workOrders.length - incompleteWorkOrders.length}/{workOrders.length} completed
                </Text>
              </Group>
              {hasIncompleteWorkOrders && (
                <Text size="xs" mt={4}>
                  {incompleteWorkOrders.length} work order(s) still in progress. You can still close, but consider completing them first.
                </Text>
              )}
            </Alert>
          )}

          <Divider />

          {/* Role Selection (temporary until RBAC) */}
          <Select
            label="Your Role"
            description="Temporary: Select your Gov role for authorization"
            placeholder="Select role"
            data={GOV_ROLE_OPTIONS}
            value={selectedRole}
            onChange={setSelectedRole}
            required
          />

          {/* Close Notes */}
          <Textarea
            label="Close Notes"
            description="Optional notes about the event closure"
            placeholder="Any notes about this closure..."
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.currentTarget.value)}
            minRows={2}
          />

          <Divider />

          {/* Action Buttons */}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              color="teal"
              onClick={handleCloseEvent}
              loading={closeEvent.isPending}
              disabled={!selectedRole}
              leftSection={<IconCheck size={16} />}
            >
              Close Event
            </Button>
          </Group>
        </Stack>
      ) : (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          This event is not in pending review status and cannot be closed.
        </Alert>
      )}
    </Modal>
  );
}
