import {
  Modal,
  Stack,
  Text,
  Badge,
  Group,
  Button,
  Paper,
  Alert,
  Loader,
  Center,
  Divider,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconTrash, IconAlertCircle, IconMapPin, IconCalendar } from '@tabler/icons-react';
import { useInspection, useDeleteInspection, useEvent, useAsset } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';

interface InspectionDetailModalProps {
  inspectionId: string;
  onClose: () => void;
}

function getResultBadgeColor(result: string) {
  switch (result) {
    case 'pass':
      return 'green';
    case 'fail':
      return 'red';
    case 'pending':
      return 'yellow';
    default:
      return 'gray';
  }
}

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
    modals.openConfirmModal({
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
            notifications.show({
              title: 'Inspection Deleted',
              message: 'Inspection record has been deleted.',
              color: 'green',
            });
            onClose();
          },
          onError: (error) => {
            notifications.show({
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
      <Modal opened onClose={onClose} title="Inspection Details" centered zIndex={300}>
        <Center h={200}>
          <Loader size="lg" />
        </Center>
      </Modal>
    );
  }

  if (!inspection) {
    return (
      <Modal opened onClose={onClose} title="Inspection Details" centered zIndex={300}>
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Inspection not found
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={600}>Inspection Details</Text>
          <Badge color={getResultBadgeColor(inspection.result)}>
            {getResultLabel(inspection.result)}
          </Badge>
        </Group>
      }
      size="md"
      centered
      zIndex={300}
    >
      <Stack gap="md">
        {/* Linked Entity */}
        <Paper p="sm" withBorder>
          <Text size="xs" c="dimmed" mb={4}>
            Linked To
          </Text>
          {linkedEvent ? (
            <div>
              <Text size="sm" fw={500}>
                Event: {linkedEvent.name}
              </Text>
              <Badge size="xs" mt={4}>
                {linkedEvent.status}
              </Badge>
            </div>
          ) : linkedAsset ? (
            <div>
              <Text size="sm" fw={500}>
                Asset: {linkedAsset.displayName || linkedAsset.name || linkedAsset.ref || linkedAsset.id}
              </Text>
              <Badge size="xs" mt={4} color="violet">
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
            <Text size="xs" c="dimmed" mb={4}>
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
            variant="light"
            leftSection={<IconEdit size={14} />}
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={handleDelete}
            loading={deleteInspection.isPending}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
