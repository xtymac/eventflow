import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EventDetailPanel } from './EventDetailPanel';

interface EventDetailModalProps {
  eventId: string;
  onClose: () => void;
}

export function EventDetailModal({ eventId, onClose }: EventDetailModalProps) {
  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">Event Detail</DialogTitle>
        </DialogHeader>
        <EventDetailPanel eventId={eventId} showBackButton={false} />
      </DialogContent>
    </Dialog>
  );
}
