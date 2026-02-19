import { Stack, Text, Paper, Group, Center, Loader } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconPlus, IconAlertCircle, IconTool, IconEye, IconHammer } from '@tabler/icons-react';
import { useWorkOrders } from '../../hooks/useApi';
import type { WorkOrderStatus, WorkOrderType } from '@nagoya/shared';
import dayjs from 'dayjs';

interface WorkOrdersListSectionProps {
  eventId: string;
  onCreateWorkOrder: () => void;
  onSelectWorkOrder: (workOrderId: string) => void;
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const TYPE_ICONS: Record<WorkOrderType, typeof IconTool> = {
  inspection: IconEye,
  repair: IconHammer,
  update: IconTool,
};

export function WorkOrdersListSection({ eventId, onCreateWorkOrder, onSelectWorkOrder }: WorkOrdersListSectionProps) {
  const { data, isLoading, error } = useWorkOrders(eventId);
  const workOrders = data?.data || [];

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
        <AlertDescription>Failed to load work orders</AlertDescription>
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>
          Work Orders ({workOrders.length})
        </Text>
        <Button
          size="sm"
          variant="outline"
          onClick={onCreateWorkOrder}
        >
          <IconPlus size={12} className="mr-1" />
          Add
        </Button>
      </Group>

      {workOrders.length === 0 ? (
        <Text size="xs" c="dimmed">
          No work orders for this event.
        </Text>
      ) : (
        <Stack gap="xs">
          {workOrders.map((wo) => {
            const TypeIcon = TYPE_ICONS[wo.type] || IconTool;
            return (
              <Paper
                key={wo.id}
                p="xs"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectWorkOrder(wo.id)}
              >
                <Group justify="space-between">
                  <Group gap="xs">
                    <TypeIcon size={14} />
                    <Text size="xs" truncate fw={500}>
                      {wo.title}
                    </Text>
                  </Group>
                  <Badge className={STATUS_COLORS[wo.status]}>
                    {STATUS_LABELS[wo.status]}
                  </Badge>
                </Group>
                <Group gap="xs" mt="xs">
                  <Badge variant="outline" className="text-xs">
                    {wo.type}
                  </Badge>
                  {wo.assignedDept && (
                    <Text size="xs" c="dimmed">
                      {wo.assignedDept}
                    </Text>
                  )}
                  {wo.dueDate && (
                    <Text size="xs" c="dimmed">
                      Due: {dayjs(wo.dueDate).format('MM/DD')}
                    </Text>
                  )}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
