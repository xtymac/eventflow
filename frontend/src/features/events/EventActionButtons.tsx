import { Group, Button, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconPlayerPlay, IconPlayerStop, IconTrash, IconCopy, IconArchive, IconArchiveOff } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useChangeEventStatus, useCancelEvent, useArchiveEvent, useUnarchiveEvent } from '../../hooks/useApi';
import type { ConstructionEvent } from '@nagoya/shared';

interface EventActionButtonsProps {
  event: ConstructionEvent;
}

export function EventActionButtons({ event }: EventActionButtonsProps) {
  const { openEventForm, openDecisionModal, openDuplicateEventForm, selectEvent, closeEventDetailModal, selectedEventId, detailModalEventId } = useUIStore();
  const changeStatus = useChangeEventStatus();
  const cancelEvent = useCancelEvent();
  const archiveEvent = useArchiveEvent();
  const unarchiveEvent = useUnarchiveEvent();

  const handleCancelEvent = () => {
    modals.openConfirmModal({
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
            notifications.show({
              title: 'Event Cancelled',
              message: 'The event has been cancelled successfully.',
              color: 'green',
            });
          },
          onError: (error) => {
            notifications.show({
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
    modals.openConfirmModal({
      title: 'Start Event',
      children: <Text size="sm">Are you sure you want to start this event?</Text>,
      labels: { confirm: 'Start Event', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: () => changeStatus.mutate({ id: event.id, status: 'active' }),
      zIndex: 1100,
    });
  };

  const handleEndEvent = () => {
    modals.openConfirmModal({
      title: 'End Event',
      children: <Text size="sm">Are you sure you want to end this event?</Text>,
      labels: { confirm: 'End Event', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        changeStatus.mutate(
          { id: event.id, status: 'ended' },
          { onSuccess: () => openDecisionModal(event.id) }
        );
      },
      zIndex: 1100,
    });
  };

  const handleArchiveEvent = () => {
    modals.openConfirmModal({
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
            notifications.show({
              title: 'Event Archived',
              message: 'The event has been archived successfully.',
              color: 'green',
            });
          },
          onError: (error) => {
            notifications.show({
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
    modals.openConfirmModal({
      title: 'Unarchive Event',
      children: <Text size="sm">Are you sure you want to unarchive this event? It will be visible in the default list again.</Text>,
      labels: { confirm: 'Unarchive', cancel: 'Cancel' },
      confirmProps: { color: 'blue' },
      onConfirm: () => {
        unarchiveEvent.mutate(event.id, {
          onSuccess: () => {
            notifications.show({
              title: 'Event Unarchived',
              message: 'The event is now visible in the default list.',
              color: 'green',
            });
          },
          onError: (error) => {
            notifications.show({
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
  // Only planned and active events can be edited (ended/cancelled are read-only for audit)
  const canEdit = event.status === 'planned' || event.status === 'active';

  return (
    <Group gap="xs">
      {canEdit && (
        <Button
          size="xs"
          variant="light"
          leftSection={<IconEdit size={14} />}
          onClick={() => openEventForm(event.id)}
          disabled={isLoading}
        >
          Edit
        </Button>
      )}

      {event.status === 'planned' && (
        <>
          <Button
            size="xs"
            variant="light"
            color="green"
            leftSection={<IconPlayerPlay size={14} />}
            onClick={handleStartEvent}
            loading={changeStatus.isPending}
            disabled={isLoading}
          >
            Start
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={handleCancelEvent}
            loading={cancelEvent.isPending}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </>
      )}

      {event.status === 'active' && (
        <Button
          size="xs"
          variant="light"
          color="red"
          leftSection={<IconPlayerStop size={14} />}
          onClick={handleEndEvent}
          loading={isLoading}
        >
          End
        </Button>
      )}

      {event.status === 'ended' && event.postEndDecision === 'pending' && !event.archivedAt && (
        <Button
          size="xs"
          variant="filled"
          color="orange"
          onClick={() => openDecisionModal(event.id)}
          disabled={isLoading}
        >
          Set Decision
        </Button>
      )}

      {event.status === 'ended' && !event.archivedAt && (
        <>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconCopy size={14} />}
            onClick={() => openDuplicateEventForm(event.id)}
            disabled={isLoading}
          >
            Duplicate
          </Button>
          <Button
            size="xs"
            variant="light"
            color="gray"
            leftSection={<IconArchive size={14} />}
            onClick={handleArchiveEvent}
            loading={archiveEvent.isPending}
            disabled={isLoading}
          >
            Archive
          </Button>
        </>
      )}

      {event.archivedAt && (
        <>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconCopy size={14} />}
            onClick={() => openDuplicateEventForm(event.id)}
            disabled={isLoading}
          >
            Duplicate
          </Button>
          <Button
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconArchiveOff size={14} />}
            onClick={handleUnarchiveEvent}
            loading={unarchiveEvent.isPending}
            disabled={isLoading}
          >
            Unarchive
          </Button>
        </>
      )}
    </Group>
  );
}
