import { Modal } from '@mantine/core';
import { EventDetailPanel } from './EventDetailPanel';

interface EventDetailModalProps {
  eventId: string;
  onClose: () => void;
}

export function EventDetailModal({ eventId, onClose }: EventDetailModalProps) {
  return (
    <Modal
      opened={true}
      onClose={onClose}
      size="lg"
      withCloseButton
    >
      <EventDetailPanel eventId={eventId} showBackButton={false} />
    </Modal>
  );
}
