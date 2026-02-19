import { Stack, Text, Group, Center, Loader } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { IconPlus } from '@tabler/icons-react';
import { useInspections } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { InspectionRecord } from '@nagoya/shared';
import dayjs from 'dayjs';

const resultColorMap: Record<string, string> = {
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="default" size="icon" onClick={() => openInspectionForm()}>
              <IconPlus size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create new inspection</TooltipContent>
        </Tooltip>
      </Group>

      <Stack gap="xs">
        {inspections.map((inspection: InspectionRecord) => (
          <div
            key={inspection.id}
            className="p-2 rounded-sm border cursor-pointer"
            style={{
              borderColor: selectedInspectionId === inspection.id ? 'hsl(var(--primary))' : undefined,
              backgroundColor: selectedInspectionId === inspection.id ? 'hsl(var(--primary) / 0.05)' : undefined,
            }}
            onClick={() => selectInspection(inspection.id)}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={500} size="sm">
                {dayjs(inspection.inspectionDate).format('YYYY/MM/DD')}
              </Text>
              <Badge
                className={resultColorMap[inspection.result] || 'bg-gray-100 text-gray-800'}
              >
                {inspection.result}
              </Badge>
            </Group>

            <Group gap="xs" mb="xs">
              {inspection.eventId && (
                <Badge variant="outline" className="text-xs">
                  Event: {inspection.eventId}
                </Badge>
              )}
              {inspection.roadAssetId && (
                <Badge variant="outline" className="text-xs">
                  Asset: {inspection.roadAssetId}
                </Badge>
              )}
            </Group>

            {inspection.notes && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {inspection.notes}
              </Text>
            )}
          </div>
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
