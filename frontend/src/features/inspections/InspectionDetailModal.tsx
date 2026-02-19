import { Stack, Text, Group, Paper, Center, Loader, Divider } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { showNotification } from '@/lib/toast';
import { IconEdit, IconTrash, IconAlertCircle, IconMapPin, IconCalendar } from '@tabler/icons-react';
import { useInspection, useDeleteInspection, useEvent, useAsset } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';

interface InspectionDetailModalProps {
  inspectionId: string;
  onClose: () => void;
}

const resultBadgeColorMap: Record<string, string> = {
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

function getResultLabel(result: string) {
  switch (result) {
    case 'pass':
      return 'Pass';
    case 'fail':
      return 'Fail';
    case 'pending':
      return 'Pending Review';
    case 'na':
      return 'N/A';
    default:
      return result;
  }
}

export function InspectionDetailModal({ inspectionId, onClose }: InspectionDetailModalProps) {
  const { openInspectionForm } = useUIStore();
  const { openConfirmModal } = useConfirmDialog();

  const { data: inspectionData, isLoading } = useInspection(inspectionId);
  const inspection = inspectionData?.data;

  // Load linked entity details
  const { data: eventData } = useEvent(inspection?.eventId ?? null);
  const { data: assetData } = useAsset(inspection?.roadAssetId ?? null);

  const linkedEvent = eventData?.data;
  const linkedAsset = assetData?.data;

  const deleteInspection = useDeleteInspection();

  const handleEdit = () => {
    onClose();
    openInspectionForm(inspectionId);
  };

  const handleDelete = () => {
    openConfirmModal({
      title: 'Delete Inspection',
      children: (
        <Text size="sm">
          Are you sure you want to delete this inspection record? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteInspection.mutate(inspectionId, {
          onSuccess: () => {
            showNotification({
              title: 'Inspection Deleted',
              message: 'Inspection record has been deleted.',
              color: 'green',
            });
            onClose();
          },
          onError: (error) => {
            showNotification({
              title: 'Delete Failed',
              message: error instanceof Error ? error.message : 'Failed to delete inspection',
              color: 'red',
            });
          },
        });
      },
      zIndex: 1100,
    });
  };

  if (isLoading) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inspection Details</DialogTitle>
          </DialogHeader>
          <Center h={200}>
            <Loader size="lg" />
          </Center>
        </DialogContent>
      </Dialog>
    );
  }

  if (!inspection) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inspection Details</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <IconAlertCircle size={16} />
            <AlertDescription>Inspection not found</AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Group gap="xs">
              <span>Inspection Details</span>
              <Badge className={resultBadgeColorMap[inspection.result] || 'bg-gray-100 text-gray-800'}>
                {getResultLabel(inspection.result)}
              </Badge>
            </Group>
          </DialogTitle>
        </DialogHeader>
        <Stack gap="md">
          {/* Linked Entity */}
          <Paper p="sm" withBorder>
            <Text size="xs" c="dimmed" mb="xs">
              Linked To
            </Text>
            {linkedEvent ? (
              <div>
                <Text size="sm" fw={500}>
                  Event: {linkedEvent.name}
                </Text>
                <Badge className="mt-1">
                  {linkedEvent.status}
                </Badge>
              </div>
            ) : linkedAsset ? (
              <div>
                <Text size="sm" fw={500}>
                  Asset: {linkedAsset.displayName || linkedAsset.name || linkedAsset.ref || linkedAsset.id}
                </Text>
                <Badge variant="secondary" className="mt-1">
                  {linkedAsset.roadType}
                </Badge>
              </div>
            ) : (
              <Text size="sm" c="dimmed">
                No linked entity
              </Text>
            )}
          </Paper>

          <Divider />

          {/* Date */}
          <Group gap="xs">
            <IconCalendar size={16} />
            <Text size="sm">
              <strong>Date:</strong> {new Date(inspection.inspectionDate).toLocaleDateString()}
            </Text>
          </Group>

          {/* Location */}
          <Group gap="xs">
            <IconMapPin size={16} />
            <Text size="sm">
              <strong>Location:</strong>{' '}
              {inspection.geometry
                ? `${inspection.geometry.coordinates[0].toFixed(5)}, ${inspection.geometry.coordinates[1].toFixed(5)}`
                : 'Not set'}
            </Text>
          </Group>

          {/* Notes */}
          {inspection.notes && (
            <Paper p="sm" withBorder>
              <Text size="xs" c="dimmed" mb="xs">
                Notes
              </Text>
              <Text size="sm">{inspection.notes}</Text>
            </Paper>
          )}

          {/* Created date */}
          <Text size="xs" c="dimmed">
            Created: {new Date(inspection.createdAt).toLocaleString()}
          </Text>

          <Divider />

          {/* Action Buttons */}
          <Group justify="flex-end">
            <Button
              variant="outline"
              onClick={handleEdit}
            >
              <IconEdit size={14} className="mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleteInspection.isPending}
            >
              <IconTrash size={14} className="mr-1" />
              {deleteInspection.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </Group>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
