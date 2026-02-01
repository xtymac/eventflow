import { useState } from 'react';
import { Modal, Stack, Button, Text, Alert, Textarea, Switch, Select, Group, Divider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useSetPostEndDecision, useArchiveEvent, useCloseEvent, useWorkOrders, useEvent } from '../../hooks/useApi';

// Temporary Gov role options (Phase 3 will have proper RBAC)
const GOV_ROLE_OPTIONS = [
  { value: 'gov_admin', label: 'Gov Admin' },
  { value: 'gov_event_ops', label: 'Gov Event Ops' },
];

export function DecisionModal() {
  const { isDecisionModalOpen, decisionEventId, closeDecisionModal } = useUIStore();
  const setDecision = useSetPostEndDecision();
  const archiveEvent = useArchiveEvent();
  const closeEvent = useCloseEvent();

  // Fetch event to check status
  const { data: eventData } = useEvent(decisionEventId);
  const event = eventData?.data;

  // Fetch workorders to check completion status
  const { data: workOrdersData } = useWorkOrders(decisionEventId || undefined);
  const workOrders = workOrdersData?.data || [];

  // State for close form
  const [notifyMasterData, setNotifyMasterData] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>('gov_admin');

  // Check if all work orders are completed/cancelled
  const incompleteWorkOrders = workOrders.filter(
    wo => wo.status !== 'completed' && wo.status !== 'cancelled'
  );
  const hasIncompleteWorkOrders = incompleteWorkOrders.length > 0;

  // Determine which flow to show
  const isPendingReview = event?.status === 'pending_review';

  // Reset form when modal closes
  const handleClose = () => {
    setNotifyMasterData(false);
    setCloseNotes('');
    setSelectedRole('gov_admin');
    closeDecisionModal();
  };

  // Phase 1: Close event flow for pending_review status
  const handleCloseEvent = () => {
    if (!decisionEventId || !selectedRole) return;

    closeEvent.mutate(
      {
        id: decisionEventId,
        data: {
          notifyMasterData,
          closeNotes: closeNotes || undefined,
        },
        userRole: selectedRole,
      },
      {
        onSuccess: (response) => {
          handleClose();
          const message = response.data.notification
            ? 'Event closed. Notification created for Master Data team.'
            : 'Event closed successfully.';
          notifications.show({
            title: 'Event Closed',
            message,
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

  // Legacy: Phase 0 decision flow for ended status
  const handleSetDecision = (decision: 'no-change') => {
    if (!decisionEventId) return;
    setDecision.mutate(
      { id: decisionEventId, decision },
      {
        onSuccess: () => {
          handleClose();

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
        },
      }
    );
  };

  return (
    <Modal
      opened={isDecisionModalOpen}
      onClose={handleClose}
      title={isPendingReview ? 'Close Event' : 'Set Post-End Decision'}
      centered
      zIndex={300}
      size="md"
    >
      {!decisionEventId ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          No event selected. Please close and try again.
        </Alert>
      ) : isPendingReview ? (
        /* Phase 1: Close Event Flow */
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

          {/* Notify Master Data Decision */}
          <Switch
            label="Notify Master Data team"
            description="Send notification about asset changes that need to be applied to the Master Data database"
            checked={notifyMasterData}
            onChange={(e) => setNotifyMasterData(e.currentTarget.checked)}
            color="teal"
          />

          {notifyMasterData && (
            <Alert color="blue" icon={<IconAlertCircle size={16} />}>
              A notification will be created in the outbox for the Master Data team to review and apply changes.
            </Alert>
          )}

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
        /* Legacy: Phase 0 Decision Flow */
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
            No Change (Archive)
          </Button>
          <Alert color="blue" icon={<IconAlertCircle size={16} />}>
            Road updates are currently disabled (Phase 0). Asset changes will be managed through WorkOrders in future phases.
          </Alert>
        </Stack>
      )}
    </Modal>
  );
}
