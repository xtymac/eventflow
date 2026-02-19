import { useState } from 'react';
import { Stack, Group, Text, Divider } from '@/components/shims';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { showNotification } from '@/lib/toast';
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
          showNotification({
            title: 'Event Closed',
            message: 'Event closed successfully.',
            color: 'green',
          });
        },
        onError: (error) => {
          showNotification({
            title: 'Close Failed',
            message: error instanceof Error ? error.message : 'Failed to close event',
            color: 'red',
          });
        },
      }
    );
  };

  return (
    <Dialog open={isDecisionModalOpen} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent style={{ zIndex: 300 }}>
        <DialogHeader>
          <DialogTitle>Close Event</DialogTitle>
        </DialogHeader>

        {!decisionEventId ? (
          <Alert variant="destructive">
            <IconAlertCircle size={16} />
            <AlertDescription>
              No event selected. Please close and try again.
            </AlertDescription>
          </Alert>
        ) : isPendingReview ? (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Review the event and confirm closure. Gov role required.
            </Text>

            {/* Work Orders Status */}
            {workOrders.length > 0 && (
              <Alert variant={hasIncompleteWorkOrders ? 'default' : 'default'} className={hasIncompleteWorkOrders ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'}>
                {hasIncompleteWorkOrders ? <IconAlertCircle size={16} /> : <IconCheck size={16} />}
                <AlertDescription>
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      Work Orders: {workOrders.length - incompleteWorkOrders.length}/{workOrders.length} completed
                    </Text>
                  </Group>
                  {hasIncompleteWorkOrders && (
                    <Text size="xs" mt="xs">
                      {incompleteWorkOrders.length} work order(s) still in progress. You can still close, but consider completing them first.
                    </Text>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Divider />

            {/* Role Selection (temporary until RBAC) */}
            <div className="flex flex-col gap-1.5">
              <Label>
                Your Role <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">Temporary: Select your Gov role for authorization</p>
              <Select
                value={selectedRole || undefined}
                onValueChange={setSelectedRole}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {GOV_ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Close Notes */}
            <div className="flex flex-col gap-1.5">
              <Label>Close Notes</Label>
              <p className="text-xs text-muted-foreground">Optional notes about the event closure</p>
              <Textarea
                placeholder="Any notes about this closure..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.currentTarget.value)}
                rows={2}
              />
            </div>

            <Divider />

            {/* Action Buttons */}
            <Group justify="flex-end">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleCloseEvent}
                disabled={closeEvent.isPending || !selectedRole}
              >
                <IconCheck size={16} />
                Close Event
              </Button>
            </Group>
          </Stack>
        ) : (
          <Alert className="border-yellow-300 bg-yellow-50">
            <IconAlertCircle size={16} />
            <AlertDescription>
              This event is not in pending review status and cannot be closed.
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
