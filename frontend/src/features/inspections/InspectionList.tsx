import {
  Stack,
  Card,
  Text,
  Badge,
  Group,
  Loader,
  Center,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useInspections } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { InspectionRecord } from '@nagoya/shared';
import dayjs from 'dayjs';

export function InspectionList() {
  const { data, isLoading, error } = useInspections();
  const { selectedInspectionId, selectInspection, openInspectionForm } = useUIStore();

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return (
      <Center py="xl">
        <Text c="red">Failed to load inspections</Text>
      </Center>
    );
  }

  const inspections = data?.data || [];

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600}>Inspections ({inspections.length})</Text>
        <Tooltip label="Create new inspection">
          <ActionIcon variant="filled" onClick={() => openInspectionForm()}>
            <IconPlus size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Stack gap="xs">
        {inspections.map((inspection: InspectionRecord) => (
          <Card
            key={inspection.id}
            padding="sm"
            radius="sm"
            withBorder
            style={{
              cursor: 'pointer',
              borderColor: selectedInspectionId === inspection.id ? 'var(--mantine-color-blue-5)' : undefined,
              backgroundColor: selectedInspectionId === inspection.id ? 'var(--mantine-color-blue-0)' : undefined,
            }}
            onClick={() => selectInspection(inspection.id)}
          >
            <Group justify="space-between" mb={4}>
              <Text fw={500} size="sm">
                {dayjs(inspection.inspectionDate).format('YYYY/MM/DD')}
              </Text>
              <Badge
                color={inspection.result === 'pass' ? 'green' : inspection.result === 'fail' ? 'red' : 'yellow'}
                size="sm"
              >
                {inspection.result}
              </Badge>
            </Group>

            <Group gap="xs" mb={4}>
              <Badge variant="outline" size="xs" color="gray">
                {inspection.relatedType}: {inspection.relatedId}
              </Badge>
            </Group>

            {inspection.notes && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {inspection.notes}
              </Text>
            )}
          </Card>
        ))}

        {inspections.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            No inspections found
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
