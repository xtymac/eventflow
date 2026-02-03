import { useState } from 'react';
import { Modal, Stack, TextInput, Textarea, Select, Button, Group } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import { useCreateWorkOrder } from '../../hooks/useApi';

interface WorkOrderCreateModalProps {
  eventId: string | null;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'inspection', label: 'Inspection' },
  { value: 'repair', label: 'Repair' },
  { value: 'update', label: 'Update' },
];

export function WorkOrderCreateModal({ eventId, onClose }: WorkOrderCreateModalProps) {
  const createWorkOrder = useCreateWorkOrder();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<string | null>('inspection');
  const [description, setDescription] = useState('');
  const [assignedDept, setAssignedDept] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);

  const handleSubmit = () => {
    if (!eventId || !title || !type) return;

    createWorkOrder.mutate(
      {
        eventId,
        type: type as 'inspection' | 'repair' | 'update',
        title,
        description: description || undefined,
        assignedDept: assignedDept || undefined,
        dueDate: dueDate ? dueDate.toISOString() : undefined,
        status: 'draft',
      },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Work Order Created',
            message: `"${title}" has been created.`,
            color: 'green',
          });
          handleClose();
        },
        onError: (err) => {
          notifications.show({
            title: 'Creation Failed',
            message: err instanceof Error ? err.message : 'Failed to create work order',
            color: 'red',
          });
        },
      }
    );
  };

  const handleClose = () => {
    setTitle('');
    setType('inspection');
    setDescription('');
    setAssignedDept('');
    setDueDate(null);
    onClose();
  };

  return (
    <Modal
      opened={!!eventId}
      onClose={handleClose}
      title="Create Work Order"
      centered
      zIndex={300}
    >
      <Stack gap="sm">
        <TextInput
          label="Title"
          placeholder="Work order title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="Type"
          data={TYPE_OPTIONS}
          value={type}
          onChange={setType}
          required
        />

        <Textarea
          label="Description"
          placeholder="Optional description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          minRows={3}
        />

        <TextInput
          label="Assigned Department"
          placeholder="e.g. Infrastructure Maintenance"
          value={assignedDept}
          onChange={(e) => setAssignedDept(e.target.value)}
        />

        <DatePickerInput
          label="Due Date"
          placeholder="Optional due date"
          value={dueDate}
          onChange={setDueDate}
          clearable
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createWorkOrder.isPending}
            disabled={!title || !type}
            leftSection={<IconCheck size={16} />}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
