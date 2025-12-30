import { Group, Button, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconEdit, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useChangeEventStatus } from '../../hooks/useApi';
import type { ConstructionEvent } from '@nagoya/shared';

interface EventActionButtonsProps {
  event: ConstructionEvent;
}

export function EventActionButtons({ event }: EventActionButtonsProps) {
  const { openEventForm, openDecisionModal } = useUIStore();
  const changeStatus = useChangeEventStatus();

  const handleStartEvent = () => {
    modals.openConfirmModal({
      title: 'Start Event',
      children: <Text size="sm">Are you sure you want to start this event?</Text>,
      labels: { confirm: 'Start Event', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: () => changeStatus.mutate({ id: event.id, status: 'active' }),
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
    });
  };

  const isLoading = changeStatus.isPending;

  return (
    <Group gap="xs">
      <Button
        size="xs"
        variant="light"
        leftSection={<IconEdit size={14} />}
        onClick={() => openEventForm(event.id)}
        disabled={isLoading}
      >
        Edit
      </Button>

      {event.status === 'planned' && (
        <Button
          size="xs"
          variant="light"
          color="green"
          leftSection={<IconPlayerPlay size={14} />}
          onClick={handleStartEvent}
          loading={isLoading}
        >
          Start
        </Button>
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
