import { useState } from 'react';
import { Modal, Stack, Text, Badge, Group, Button, Divider, Alert, Loader, Center, Paper, FileInput, TextInput, Select, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconUpload, IconFile, IconCheck, IconX } from '@tabler/icons-react';
import { useWorkOrder, useUpdateWorkOrderStatus, useEvidence, useUploadEvidence, useMakeEvidenceDecision } from '../../hooks/useApi';
import type { WorkOrderStatus, EvidenceReviewStatus } from '@nagoya/shared';
import dayjs from 'dayjs';

interface WorkOrderDetailModalProps {
  workOrderId: string | null;
  onClose: () => void;
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
const EVIDENCE_STATUS_CONFIG: Record<EvidenceReviewStatus, { color: string; label: string }> = {
  pending: { color: 'yellow', label: '待審査' },
  approved: { color: 'blue', label: '審査済' },
  rejected: { color: 'red', label: '却下' },
  accepted_by_authority: { color: 'green', label: '政府承認' },
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
          notifications.show({
            title: 'Status Updated',
            message: `Work order status changed to ${STATUS_LABELS[newStatus]}.`,
            color: 'green',
          });
        },
        onError: (err) => {
          notifications.show({
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
          notifications.show({
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
          notifications.show({
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
          notifications.show({
            title: decision === 'accepted_by_authority' ? '承認完了' : '却下完了',
            message: decision === 'accepted_by_authority' ? 'Evidence has been accepted.' : 'Evidence has been rejected.',
            color: decision === 'accepted_by_authority' ? 'green' : 'red',
          });
        },
        onError: (err) => {
          notifications.show({
            title: 'Decision Failed',
            message: err instanceof Error ? err.message : 'Failed to make decision',
            color: 'red',
          });
        },
      }
    );
  };

  return (
    <Modal
      opened={!!workOrderId}
      onClose={onClose}
      title="Work Order Details"
      centered
      size="lg"
      zIndex={300}
    >
      {isLoading ? (
        <Center h={200}>
          <Loader size="sm" />
        </Center>
      ) : error || !workOrder ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Failed to load work order details
        </Alert>
      ) : (
        <Stack gap="md">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Stack gap={4} style={{ flex: 1 }}>
              <Text fw={600} size="lg">{workOrder.title}</Text>
              <Text size="xs" c="dimmed" ff="monospace">{workOrder.id}</Text>
            </Stack>
            <Badge size="lg" color={STATUS_COLORS[workOrder.status]}>
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
              <Stack gap={2}>
                <Text size="xs" c="dimmed">Created</Text>
                <Text size="sm">{dayjs(workOrder.createdAt).format('YYYY/MM/DD HH:mm')}</Text>
              </Stack>
              {workOrder.dueDate && (
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">Due</Text>
                  <Text size="sm">{dayjs(workOrder.dueDate).format('YYYY/MM/DD')}</Text>
                </Stack>
              )}
              {workOrder.completedAt && (
                <Stack gap={2}>
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
                      size="xs"
                      color={config?.color || 'gray'}
                      variant={status === 'cancelled' ? 'light' : 'filled'}
                      onClick={() => handleStatusChange(status)}
                      loading={updateStatus.isPending}
                    >
                      {config?.label || status}
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
                size="compact-xs"
                variant="light"
                leftSection={<IconUpload size={12} />}
                onClick={() => setShowUploadForm(!showUploadForm)}
              >
                Upload
              </Button>
            </Group>

            {/* Gov Role Selector (shown when there are evidence items needing approval) */}
            {hasApprovedEvidence && (
              <Select
                label="政府ロール（仮）"
                description="Evidence 承認用のロールを選択"
                placeholder="Select role"
                size="xs"
                data={GOV_ROLE_OPTIONS}
                value={selectedRole}
                onChange={setSelectedRole}
              />
            )}

            {/* Upload Form */}
            {showUploadForm && (
              <Paper p="sm" withBorder>
                <Stack gap="xs">
                  <FileInput
                    label="File"
                    placeholder="Select file..."
                    value={uploadFile}
                    onChange={setUploadFile}
                    leftSection={<IconFile size={14} />}
                    size="xs"
                    required
                  />
                  <Select
                    label="Type"
                    data={EVIDENCE_TYPE_OPTIONS}
                    value={evidenceType}
                    onChange={setEvidenceType}
                    size="xs"
                    required
                  />
                  <TextInput
                    label="Title"
                    placeholder="Optional title"
                    value={evidenceTitle}
                    onChange={(e) => setEvidenceTitle(e.target.value)}
                    size="xs"
                  />
                  <Textarea
                    label="Description"
                    placeholder="Optional description"
                    value={evidenceDescription}
                    onChange={(e) => setEvidenceDescription(e.target.value)}
                    size="xs"
                    minRows={2}
                  />
                  <Group justify="flex-end" gap="xs">
                    <Button size="xs" variant="subtle" onClick={() => setShowUploadForm(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      onClick={handleUploadEvidence}
                      loading={uploadEvidence.isPending}
                      disabled={!uploadFile || !evidenceType}
                      leftSection={<IconUpload size={14} />}
                    >
                      Upload
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
              <Stack gap={4}>
                {evidenceList.map((ev) => {
                  const statusConfig = EVIDENCE_STATUS_CONFIG[ev.reviewStatus as EvidenceReviewStatus] || { color: 'gray', label: ev.reviewStatus };
                  const showDecisionButtons = canMakeDecision && ev.reviewStatus === 'approved';

                  return (
                    <Paper key={ev.id} p="xs" withBorder>
                      <Stack gap="xs">
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                            <IconFile size={14} />
                            <Stack gap={0} style={{ minWidth: 0 }}>
                              <Text size="xs" fw={500} truncate>
                                {ev.title || ev.fileName}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {ev.type} - {dayjs(ev.submittedAt).format('MM/DD HH:mm')}
                              </Text>
                            </Stack>
                          </Group>
                          <Badge size="xs" color={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                        </Group>

                        {/* Government Decision Buttons */}
                        {showDecisionButtons && (
                          <Group gap="xs" justify="flex-end">
                            <Button
                              size="compact-xs"
                              color="green"
                              leftSection={<IconCheck size={12} />}
                              onClick={() => handleMakeDecision(ev.id, 'accepted_by_authority')}
                              loading={makeDecision.isPending}
                            >
                              承認
                            </Button>
                            <Button
                              size="compact-xs"
                              color="red"
                              variant="light"
                              leftSection={<IconX size={12} />}
                              onClick={() => handleMakeDecision(ev.id, 'rejected')}
                              loading={makeDecision.isPending}
                            >
                              却下
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
    </Modal>
  );
}
