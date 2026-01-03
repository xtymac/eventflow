import { Group, Button, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconEdit, IconPlayerPlay, IconPlayerStop, IconTrash } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useChangeEventStatus, useCancelEvent } from '../../hooks/useApi';
import type { ConstructionEvent } from '@nagoya/shared';

interface EventActionButtonsProps {
  event: ConstructionEvent;
}

export function EventActionButtons({ event }: EventActionButtonsProps) {
  const { openEventForm, openDecisionModal } = useUIStore();
  const changeStatus = useChangeEventStatus();
  const cancelEvent = useCancelEvent();

  const handleCancelEvent = () => {
    modals.openConfirmModal({
      title: 'Cancel Event',
      children: <Text size="sm">Are you sure you want to cancel this event? This action cannot be undone.</Text>,
      labels: { confirm: 'Cancel Event', cancel: 'Keep Event' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        cancelEvent.mutate(event.id);
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

  const isLoading = changeStatus.isPending || cancelEvent.isPending;
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

      {event.status === 'ended' && event.postEndDecision === 'pending' && (
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
    </Group>
  );
}
