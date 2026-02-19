import { useState } from 'react';
import { Stack, Group } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { showNotification } from '@/lib/toast';
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
          showNotification({
            title: 'Work Order Created',
            message: `"${title}" has been created.`,
            color: 'green',
          });
          handleClose();
        },
        onError: (err) => {
          showNotification({
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
    <Dialog open={!!eventId} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>
        <Stack gap="sm">
          <div>
            <Label className="mb-1 block">Title *</Label>
            <Input
              placeholder="Work order title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block">Type *</Label>
            <Select value={type || ''} onValueChange={setType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1 block">Description</Label>
            <Textarea
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label className="mb-1 block">Assigned Department</Label>
            <Input
              placeholder="e.g. Infrastructure Maintenance"
              value={assignedDept}
              onChange={(e) => setAssignedDept(e.target.value)}
            />
          </div>

          <DatePickerInput
            label="Due Date"
            placeholder="Optional due date"
            value={dueDate}
            onChange={setDueDate}
            clearable
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!title || !type || createWorkOrder.isPending}
            >
              <IconCheck size={16} className="mr-1" />
              {createWorkOrder.isPending ? 'Creating...' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
