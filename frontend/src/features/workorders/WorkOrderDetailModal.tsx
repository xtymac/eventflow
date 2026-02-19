import { useState } from 'react';
import { Stack, Text, Group, Paper, Center, Loader, Divider } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { showNotification } from '@/lib/toast';
import { IconAlertCircle, IconUpload, IconFile, IconCheck, IconX } from '@tabler/icons-react';
import { useWorkOrder, useUpdateWorkOrderStatus, useEvidence, useUploadEvidence, useMakeEvidenceDecision } from '../../hooks/useApi';
import type { WorkOrderStatus, EvidenceReviewStatus } from '@nagoya/shared';
import dayjs from 'dayjs';

interface WorkOrderDetailModalProps {
  workOrderId: string | null;
  onClose: () => void;
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

// Valid status transitions (matches backend)
const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  draft: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const TRANSITION_LABELS: Record<string, { label: string; color: string }> = {
  assigned: { label: 'Assign', color: 'blue' },
  in_progress: { label: 'Start Work', color: 'yellow' },
  completed: { label: 'Mark Complete', color: 'green' },
  cancelled: { label: 'Cancel', color: 'red' },
};

const EVIDENCE_TYPE_OPTIONS = [
  { value: 'photo', label: 'Photo' },
  { value: 'document', label: 'Document' },
  { value: 'report', label: 'Report' },
  { value: 'cad', label: 'CAD Drawing' },
  { value: 'other', label: 'Other' },
];

// Evidence review status configuration
const EVIDENCE_STATUS_CONFIG: Record<EvidenceReviewStatus, { className: string; label: string }> = {
  pending: { className: 'bg-yellow-100 text-yellow-800', label: '待審査' },
  approved: { className: 'bg-blue-100 text-blue-800', label: '審査済' },
  rejected: { className: 'bg-red-100 text-red-800', label: '却下' },
  accepted_by_authority: { className: 'bg-green-100 text-green-800', label: '政府承認' },
};

// Government roles that can make final decisions
const GOV_DECISION_ROLES = ['gov_admin', 'gov_event_ops'];

// Role options for government decision making
const GOV_ROLE_OPTIONS = [
  { value: 'gov_admin', label: 'Gov Admin' },
  { value: 'gov_event_ops', label: 'Gov Event Ops' },
];

export function WorkOrderDetailModal({ workOrderId, onClose }: WorkOrderDetailModalProps) {
  const { data, isLoading, error } = useWorkOrder(workOrderId);
  const { data: evidenceData, isLoading: evidenceLoading } = useEvidence(workOrderId);
  const updateStatus = useUpdateWorkOrderStatus();
  const uploadEvidence = useUploadEvidence();
  const makeDecision = useMakeEvidenceDecision();

  // Evidence upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState<string | null>('photo');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');

  // Government role state for decision making (temporary until proper auth)
  const [selectedRole, setSelectedRole] = useState<string | null>('gov_admin');

  const workOrder = data?.data;
  const evidenceList = evidenceData?.data || [];
  const availableTransitions = workOrder ? VALID_TRANSITIONS[workOrder.status] || [] : [];

  // Check if user can make government decisions (always true when role is selected)
  const canMakeDecision = selectedRole && GOV_DECISION_ROLES.includes(selectedRole);

  // Check if there are any evidence items that need decision
  const hasApprovedEvidence = evidenceList.some(ev => ev.reviewStatus === 'approved');

  const handleStatusChange = (newStatus: WorkOrderStatus) => {
    if (!workOrderId) return;
    updateStatus.mutate(
      { id: workOrderId, status: newStatus },
      {
        onSuccess: () => {
          showNotification({
            title: 'Status Updated',
            message: `Work order status changed to ${STATUS_LABELS[newStatus]}.`,
            color: 'green',
          });
        },
        onError: (err) => {
          showNotification({
            title: 'Update Failed',
            message: err instanceof Error ? err.message : 'Failed to update status',
            color: 'red',
          });
        },
      }
    );
  };

  const handleUploadEvidence = () => {
    if (!workOrderId || !uploadFile || !evidenceType) return;

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('type', evidenceType);
    if (evidenceTitle) formData.append('title', evidenceTitle);
    if (evidenceDescription) formData.append('description', evidenceDescription);
    formData.append('submittedBy', 'current_user'); // Placeholder

    uploadEvidence.mutate(
      { workOrderId, formData },
      {
        onSuccess: () => {
          showNotification({
            title: 'Evidence Uploaded',
            message: 'File uploaded successfully.',
            color: 'green',
          });
          // Reset form
          setShowUploadForm(false);
          setUploadFile(null);
          setEvidenceType('photo');
          setEvidenceTitle('');
          setEvidenceDescription('');
        },
        onError: (err) => {
          showNotification({
            title: 'Upload Failed',
            message: err instanceof Error ? err.message : 'Failed to upload evidence',
            color: 'red',
          });
        },
      }
    );
  };

  const handleMakeDecision = (evidenceId: string, decision: 'accepted_by_authority' | 'rejected') => {
    if (!selectedRole) return;

    makeDecision.mutate(
      { evidenceId, decision, userRole: selectedRole },
      {
        onSuccess: () => {
          showNotification({
            title: decision === 'accepted_by_authority' ? '承認完了' : '却下完了',
            message: decision === 'accepted_by_authority' ? 'Evidence has been accepted.' : 'Evidence has been rejected.',
            color: decision === 'accepted_by_authority' ? 'green' : 'red',
          });
        },
        onError: (err) => {
          showNotification({
            title: 'Decision Failed',
            message: err instanceof Error ? err.message : 'Failed to make decision',
            color: 'red',
          });
        },
      }
    );
  };

  return (
    <Dialog open={!!workOrderId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Work Order Details</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Center h={200}>
            <Loader size="sm" />
          </Center>
        ) : error || !workOrder ? (
          <Alert variant="destructive">
            <IconAlertCircle size={16} />
            <AlertDescription>Failed to load work order details</AlertDescription>
          </Alert>
        ) : (
          <Stack gap="md">
            {/* Header */}
            <Group justify="space-between" align="start">
              <Stack gap="xs" style={{ flex: 1 }}>
                <Text fw={600} size="lg">{workOrder.title}</Text>
                <Text size="xs" c="dimmed" className="font-mono">{workOrder.id}</Text>
              </Stack>
              <Badge className={STATUS_COLORS[workOrder.status]}>
                {STATUS_LABELS[workOrder.status]}
              </Badge>
            </Group>

            {/* Details */}
            <Stack gap="xs">
              <Group gap="md">
                <Badge variant="outline">{workOrder.type}</Badge>
                {workOrder.assignedDept && (
                  <Text size="sm">Dept: {workOrder.assignedDept}</Text>
                )}
              </Group>

              {workOrder.description && (
                <Text size="sm" c="dimmed">{workOrder.description}</Text>
              )}

              <Group gap="lg">
                <Stack gap="xs">
                  <Text size="xs" c="dimmed">Created</Text>
                  <Text size="sm">{dayjs(workOrder.createdAt).format('YYYY/MM/DD HH:mm')}</Text>
                </Stack>
                {workOrder.dueDate && (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">Due</Text>
                    <Text size="sm">{dayjs(workOrder.dueDate).format('YYYY/MM/DD')}</Text>
                  </Stack>
                )}
                {workOrder.completedAt && (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">Completed</Text>
                    <Text size="sm">{dayjs(workOrder.completedAt).format('YYYY/MM/DD HH:mm')}</Text>
                  </Stack>
                )}
              </Group>
            </Stack>

            {/* Status Transitions */}
            {availableTransitions.length > 0 && (
              <>
                <Divider />
                <Group gap="xs">
                  <Text size="sm" fw={500}>Actions:</Text>
                  {availableTransitions.map((status) => {
                    const config = TRANSITION_LABELS[status];
                    return (
                      <Button
                        key={status}
                        size="sm"
                        variant={status === 'cancelled' ? 'outline' : 'default'}
                        onClick={() => handleStatusChange(status)}
                        disabled={updateStatus.isPending}
                      >
                        {updateStatus.isPending ? 'Updating...' : config?.label || status}
                      </Button>
                    );
                  })}
                </Group>
              </>
            )}

            <Divider />

            {/* Evidence Section */}
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={600}>Evidence ({evidenceList.length})</Text>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUploadForm(!showUploadForm)}
                >
                  <IconUpload size={12} className="mr-1" />
                  Upload
                </Button>
              </Group>

              {/* Gov Role Selector (shown when there are evidence items needing approval) */}
              {hasApprovedEvidence && (
                <div>
                  <Label className="mb-1 block text-xs">政府ロール（仮）</Label>
                  <p className="text-xs text-muted-foreground mb-1">Evidence 承認用のロールを選択</p>
                  <Select value={selectedRole || ''} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-full" size="sm">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {GOV_ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Upload Form */}
              {showUploadForm && (
                <Paper p="sm" withBorder>
                  <Stack gap="xs">
                    <div>
                      <Label className="mb-1 block text-xs">File *</Label>
                      <div className="flex items-center gap-2">
                        <IconFile size={14} />
                        <Input
                          type="file"
                          className="text-xs"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Type *</Label>
                      <Select value={evidenceType || ''} onValueChange={setEvidenceType}>
                        <SelectTrigger className="w-full" size="sm">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {EVIDENCE_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Title</Label>
                      <Input
                        placeholder="Optional title"
                        value={evidenceTitle}
                        onChange={(e) => setEvidenceTitle(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Description</Label>
                      <Textarea
                        placeholder="Optional description"
                        value={evidenceDescription}
                        onChange={(e) => setEvidenceDescription(e.target.value)}
                        className="text-xs"
                        rows={2}
                      />
                    </div>
                    <Group justify="flex-end" gap="xs">
                      <Button size="sm" variant="ghost" onClick={() => setShowUploadForm(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleUploadEvidence}
                        disabled={!uploadFile || !evidenceType || uploadEvidence.isPending}
                      >
                        <IconUpload size={14} className="mr-1" />
                        {uploadEvidence.isPending ? 'Uploading...' : 'Upload'}
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              )}

              {/* Evidence List */}
              {evidenceLoading ? (
                <Center h={60}>
                  <Loader size="xs" />
                </Center>
              ) : evidenceList.length === 0 ? (
                <Text size="xs" c="dimmed">No evidence uploaded yet.</Text>
              ) : (
                <Stack gap="xs">
                  {evidenceList.map((ev) => {
                    const statusConfig = EVIDENCE_STATUS_CONFIG[ev.reviewStatus as EvidenceReviewStatus] || { className: 'bg-gray-100 text-gray-800', label: ev.reviewStatus };
                    const showDecisionButtons = canMakeDecision && ev.reviewStatus === 'approved';

                    return (
                      <Paper key={ev.id} p="xs" withBorder>
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Group gap="xs">
                              <IconFile size={14} />
                              <Stack gap="xs">
                                <Text size="xs" fw={500} truncate>
                                  {ev.title || ev.fileName}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {ev.type} - {dayjs(ev.submittedAt).format('MM/DD HH:mm')}
                                </Text>
                              </Stack>
                            </Group>
                            <Badge className={statusConfig.className}>
                              {statusConfig.label}
                            </Badge>
                          </Group>

                          {/* Government Decision Buttons */}
                          {showDecisionButtons && (
                            <Group gap="xs" justify="flex-end">
                              <Button
                                size="sm"
                                onClick={() => handleMakeDecision(ev.id, 'accepted_by_authority')}
                                disabled={makeDecision.isPending}
                              >
                                <IconCheck size={12} className="mr-1" />
                                {makeDecision.isPending ? '...' : '承認'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => handleMakeDecision(ev.id, 'rejected')}
                                disabled={makeDecision.isPending}
                              >
                                <IconX size={12} className="mr-1" />
                                {makeDecision.isPending ? '...' : '却下'}
                              </Button>
                            </Group>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
