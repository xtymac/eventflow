import { Stack, Text, Paper, Badge, Group, Button, Alert, Loader, Center } from '@mantine/core';
import { IconPlus, IconAlertCircle, IconCalendar } from '@tabler/icons-react';
import { useInspections } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';

interface InspectionsListSectionProps {
  eventId: string;
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
      return 'Pending';
    case 'na':
      return 'N/A';
    default:
      return result;
  }
}

export function InspectionsListSection({ eventId }: InspectionsListSectionProps) {
  const { openInspectionForm, selectInspection } = useUIStore();
  const { data, isLoading, error } = useInspections(eventId);

  const inspections = data?.data || [];

  const handleAddInspection = () => {
    openInspectionForm(null, eventId, null);
  };

  const handleViewInspection = (inspectionId: string) => {
    selectInspection(inspectionId);
  };

  if (isLoading) {
    return (
      <Center h={100}>
        <Loader size="sm" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red">
        Failed to load inspections
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>
          Inspections ({inspections.length})
        </Text>
        <Button
          size="compact-xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={handleAddInspection}
        >
          Add
        </Button>
      </Group>

      {inspections.length === 0 ? (
        <Text size="xs" c="dimmed">
          No inspections recorded for this event.
        </Text>
      ) : (
        <Stack gap={4}>
          {inspections.map((inspection) => (
            <Paper
              key={inspection.id}
              p="xs"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => handleViewInspection(inspection.id)}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                  <IconCalendar size={14} />
                  <Text size="xs" truncate>
                    {new Date(inspection.inspectionDate).toLocaleDateString()}
                  </Text>
                </Group>
                <Badge size="xs" color={getResultBadgeColor(inspection.result)}>
                  {getResultLabel(inspection.result)}
                </Badge>
              </Group>
              {inspection.notes && (
                <Text size="xs" c="dimmed" lineClamp={1} mt={4}>
                  {inspection.notes}
                </Text>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
