import { Stack, Text, Paper, Group, Center, Loader } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconPlus, IconAlertCircle, IconCalendar } from '@tabler/icons-react';
import { useInspections } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';

interface InspectionsListSectionProps {
  eventId: string;
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
      <Alert variant="destructive">
        <IconAlertCircle size={16} />
        <AlertDescription>Failed to load inspections</AlertDescription>
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
          size="sm"
          variant="outline"
          onClick={handleAddInspection}
        >
          <IconPlus size={12} className="mr-1" />
          Add
        </Button>
      </Group>

      {inspections.length === 0 ? (
        <Text size="xs" c="dimmed">
          No inspections recorded for this event.
        </Text>
      ) : (
        <Stack gap="xs">
          {inspections.map((inspection) => (
            <Paper
              key={inspection.id}
              p="xs"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => handleViewInspection(inspection.id)}
            >
              <Group justify="space-between">
                <Group gap="xs">
                  <IconCalendar size={14} />
                  <Text size="xs" truncate>
                    {new Date(inspection.inspectionDate).toLocaleDateString()}
                  </Text>
                </Group>
                <Badge className={resultBadgeColorMap[inspection.result] || 'bg-gray-100 text-gray-800'}>
                  {getResultLabel(inspection.result)}
                </Badge>
              </Group>
              {inspection.notes && (
                <Text size="xs" c="dimmed" lineClamp={1} mt="xs">
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
