import { Group, Text } from '@/components/shims';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { showNotification } from '@/lib/toast';
// Phase 0: IconRoad removed - Road Update Mode disabled
import { IconEdit, IconPlayerPlay, IconPlayerStop, IconTrash, IconCopy, IconArchive, IconArchiveOff } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useChangeEventStatus, useCancelEvent, useArchiveEvent, useUnarchiveEvent } from '../../hooks/useApi';
import type { ConstructionEvent } from '@nagoya/shared';

interface EventActionButtonsProps {
  event: ConstructionEvent;
}

export function EventActionButtons({ event }: EventActionButtonsProps) {
  // Phase 0: enterRoadUpdateMode removed - Road Update Mode disabled
  const { openEventForm, openDecisionModal, openDuplicateEventForm, selectEvent, closeEventDetailModal, selectedEventId, detailModalEventId } = useUIStore();
  const changeStatus = useChangeEventStatus();
  const cancelEvent = useCancelEvent();
  const archiveEvent = useArchiveEvent();
  const unarchiveEvent = useUnarchiveEvent();
  const { openConfirmModal } = useConfirmDialog();

  const handleCancelEvent = () => {
    openConfirmModal({
      title: 'Cancel Event',
      children: <Text size="sm">Are you sure you want to cancel this event? This action cannot be undone.</Text>,
      labels: { confirm: 'Cancel Event', cancel: 'Keep Event' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        cancelEvent.mutate(event.id, {
          onSuccess: () => {
            // Clear selection if this event was selected
            if (selectedEventId === event.id) {
              selectEvent(null);
            }
            if (detailModalEventId === event.id) {
              closeEventDetailModal();
            }
            showNotification({
              title: 'Event Cancelled',
              message: 'The event has been cancelled successfully.',
              color: 'green',
            });
          },
          onError: (error) => {
            showNotification({
              title: 'Cancel Failed',
              message: error instanceof Error ? error.message : 'Failed to cancel event',
              color: 'red',
            });
          },
        });
      },
      zIndex: 1100,
    });
  };

  const handleStartEvent = () => {
    openConfirmModal({
      title: 'Start Event',
      children: <Text size="sm">Are you sure you want to start this event?</Text>,
      labels: { confirm: 'Start Event', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: () => changeStatus.mutate({ id: event.id, status: 'active' }),
      zIndex: 1100,
    });
  };

  const handleRequestReview = () => {
    openConfirmModal({
      title: 'Request Review',
      children: <Text size="sm">Are you sure you want to mark this event for review? This will move it to "Pending Review" status.</Text>,
      labels: { confirm: 'Request Review', cancel: 'Cancel' },
      confirmProps: { color: 'orange' },
      onConfirm: () => {
        changeStatus.mutate(
          { id: event.id, status: 'pending_review' },
          {
            onSuccess: () => {
              showNotification({
                title: 'Event Pending Review',
                message: 'The event is now awaiting Gov review for closure.',
                color: 'orange',
              });
            },
          }
        );
      },
      zIndex: 1100,
    });
  };

  const handleArchiveEvent = () => {
    openConfirmModal({
      title: 'Archive Event',
      children: <Text size="sm">Are you sure you want to archive this event? It will be hidden from the default list and map.</Text>,
      labels: { confirm: 'Archive', cancel: 'Cancel' },
      confirmProps: { color: 'gray' },
      onConfirm: () => {
        archiveEvent.mutate(event.id, {
          onSuccess: () => {
            // Clear selection if this event was selected
            if (selectedEventId === event.id) {
              selectEvent(null);
            }
            if (detailModalEventId === event.id) {
              closeEventDetailModal();
            }
            showNotification({
              title: 'Event Archived',
              message: 'The event has been archived successfully.',
              color: 'green',
            });
          },
          onError: (error) => {
            showNotification({
              title: 'Archive Failed',
              message: error instanceof Error ? error.message : 'Failed to archive event',
              color: 'red',
            });
          },
        });
      },
      zIndex: 1100,
    });
  };

  const handleUnarchiveEvent = () => {
    openConfirmModal({
      title: 'Unarchive Event',
      children: <Text size="sm">Are you sure you want to unarchive this event? It will be visible in the default list again.</Text>,
      labels: { confirm: 'Unarchive', cancel: 'Cancel' },
      confirmProps: { color: 'blue' },
      onConfirm: () => {
        unarchiveEvent.mutate(event.id, {
          onSuccess: () => {
            showNotification({
              title: 'Event Unarchived',
              message: 'The event is now visible in the default list.',
              color: 'green',
            });
          },
          onError: (error) => {
            showNotification({
              title: 'Unarchive Failed',
              message: error instanceof Error ? error.message : 'Failed to unarchive event',
              color: 'red',
            });
          },
        });
      },
      zIndex: 1100,
    });
  };

  const isLoading = changeStatus.isPending || cancelEvent.isPending || archiveEvent.isPending || unarchiveEvent.isPending;
  // Only planned and active events can be edited (closed/cancelled are read-only for audit)
  const canEdit = event.status === 'planned' || event.status === 'active';

  return (
    <Group gap="xs">
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEventForm(event.id)}
          disabled={isLoading}
        >
          <IconEdit size={14} />
          Edit
        </Button>
      )}

      {event.status === 'planned' && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="border-green-300 text-green-700 hover:bg-green-50"
            onClick={handleStartEvent}
            disabled={isLoading}
          >
            <IconPlayerPlay size={14} />
            Start
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancelEvent}
            disabled={isLoading}
          >
            <IconTrash size={14} />
            Cancel
          </Button>
        </>
      )}

      {event.status === 'active' && (
        <Button
          variant="outline"
          size="sm"
          className="border-orange-300 text-orange-700 hover:bg-orange-50"
          onClick={handleRequestReview}
          disabled={isLoading}
        >
          <IconPlayerStop size={14} />
          Request Review
        </Button>
      )}

      {/* Phase 1: pending_review status - Gov can close the event */}
      {event.status === 'pending_review' && !event.archivedAt && (
        <Button
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => openDecisionModal(event.id)}
          disabled={isLoading}
        >
          Close Event
        </Button>
      )}

      {/* Closed events can be duplicated and archived */}
      {event.status === 'closed' && !event.archivedAt && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDuplicateEventForm(event.id)}
            disabled={isLoading}
          >
            <IconCopy size={14} />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchiveEvent}
            disabled={isLoading}
          >
            <IconArchive size={14} />
            Archive
          </Button>
        </>
      )}

      {event.archivedAt && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDuplicateEventForm(event.id)}
            disabled={isLoading}
          >
            <IconCopy size={14} />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnarchiveEvent}
            disabled={isLoading}
          >
            <IconArchiveOff size={14} />
            Unarchive
          </Button>
        </>
      )}
    </Group>
  );
}
