import { Stack, Text, Paper, Badge, Group, Button, Alert, Loader, Center } from '@mantine/core';
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
  draft: 'gray',
  assigned: 'blue',
  in_progress: 'yellow',
  completed: 'green',
  cancelled: 'red',
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
      <Alert icon={<IconAlertCircle size={16} />} color="red">
        Failed to load work orders
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
          size="compact-xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={onCreateWorkOrder}
        >
          Add
        </Button>
      </Group>

      {workOrders.length === 0 ? (
        <Text size="xs" c="dimmed">
          No work orders for this event.
        </Text>
      ) : (
        <Stack gap={4}>
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
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <TypeIcon size={14} />
                    <Text size="xs" truncate fw={500}>
                      {wo.title}
                    </Text>
                  </Group>
                  <Badge size="xs" color={STATUS_COLORS[wo.status]}>
                    {STATUS_LABELS[wo.status]}
                  </Badge>
                </Group>
                <Group gap="xs" mt={4}>
                  <Badge size="xs" variant="outline">
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
