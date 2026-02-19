import { useEffect, useMemo } from 'react';
import { Stack, Group, Text, Paper, Divider, Center, Loader } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { showNotification } from '@/lib/toast';
import { IconAlertCircle, IconMapPin, IconCheck, IconTrashX } from '@tabler/icons-react';
import { useForm, Controller } from 'react-hook-form';
import { useUIStore } from '../../stores/uiStore';
import { useAsset, useCreateAsset, useUpdateAsset, useRetireAsset, useAssets } from '../../hooks/useApi';
import { getRoadAssetLabel } from '../../utils/roadAssetLabel';
import type { RoadAsset, RoadType, SupportedGeometry } from '@nagoya/shared';

type ChangeAction = 'create' | 'modify' | 'retire';

// Pending change for batch submission
export interface PendingChange {
  action: ChangeAction;
  assetId?: string;
  assetLabel?: string;
  data?: Partial<RoadAsset>;
  replacedBy?: string;
}

interface RoadChangeFormModalProps {
  opened: boolean;
  onClose: () => void;
  action: ChangeAction;
  assetId?: string | null;
  eventId: string;
  onSavePending?: (change: PendingChange) => void; // Batch mode callback
}

interface AssetFormData {
  name: string;
  nameJa: string;
  ref: string;
  localRef: string;
  roadType: RoadType;
  lanes: number;
  direction: string;
  ward: string;
  ownerDepartment: string;
  replacedBy: string; // For retire action only
  // Road Details Group
  crossSection: string;
  intersection: string;
  pavementState: string;
  managingDept: string;
  // Data Source Tracking Group
  dataSource: 'osm_test' | 'official_ledger' | 'manual';  // REQUIRED
  sourceVersion: string;
  sourceDate: Date | null;
  lastVerifiedAt: Date | null;
}

const roadTypeOptions = [
  { value: 'arterial', label: 'Arterial (\u4E3B\u8981\u5E79\u7DDA)' },
  { value: 'collector', label: 'Collector (\u88DC\u52A9\u5E79\u7DDA)' },
  { value: 'local', label: 'Local (\u751F\u6D3B\u9053\u8DEF)' },
];

const directionOptions = [
  { value: 'two-way', label: 'Two Way (\u4E21\u65B9\u5411)' },
  { value: 'one-way', label: 'One Way (\u4E00\u65B9\u901A\u884C)' },
];

const dataSourceOptions = [
  { value: 'manual', label: 'Manual Entry (\u624B\u52D5\u5165\u529B)' },
  { value: 'osm_test', label: 'OSM Test Data (OSM\u30C6\u30B9\u30C8\u30C7\u30FC\u30BF)' },
  { value: 'official_ledger', label: 'Official Ledger (\u516C\u5F0F\u53F0\u5E33)' },
];

export function RoadChangeFormModal({
  opened,
  onClose,
  action,
  assetId,
  eventId,
  onSavePending,
}: RoadChangeFormModalProps) {
  const {
    roadUpdateDrawnFeatures,
    startDrawing,
    stopDrawing,
    drawingContext,
    setDrawMode,
    clearDrawing,
  } = useUIStore();

  // Load existing asset for modify/retire
  const { data: assetData, isLoading: isLoadingAsset } = useAsset(
    action !== 'create' && assetId ? assetId : null
  );
  const existingAsset = assetData?.data;

  // Load assets for replacedBy dropdown (retire action)
  const { data: assetsData } = useAssets(
    { status: 'active', limit: 500 },
    { enabled: action === 'retire' }
  );
  const availableAssets = assetsData?.data || [];

  // Mutations
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const retireAsset = useRetireAsset();

  const isLoading = createAsset.isPending || updateAsset.isPending || retireAsset.isPending;

  const { control, handleSubmit, reset } = useForm<AssetFormData>({
    defaultValues: {
      name: '',
      nameJa: '',
      ref: '',
      localRef: '',
      roadType: 'local',
      lanes: 2,
      direction: 'two-way',
      ward: '',
      ownerDepartment: '',
      replacedBy: '',
      // Road Details - all optional, start empty
      crossSection: '',
      intersection: '',
      pavementState: '',
      managingDept: '',
      // Data Source Tracking
      dataSource: 'manual',  // REQUIRED default
      sourceVersion: '',
      sourceDate: null,
      lastVerifiedAt: null,
    },
    mode: 'onChange',
  });

  // Reset form when asset loads (for modify/retire)
  useEffect(() => {
    if (existingAsset && (action === 'modify' || action === 'retire')) {
      reset({
        name: existingAsset.name || '',
        nameJa: existingAsset.nameJa || '',
        ref: existingAsset.ref || '',
        localRef: existingAsset.localRef || '',
        roadType: existingAsset.roadType || 'local',
        lanes: existingAsset.lanes || 2,
        direction: existingAsset.direction || 'two-way',
        ward: existingAsset.ward || '',
        ownerDepartment: existingAsset.ownerDepartment || '',
        replacedBy: '',
        // Road Details
        crossSection: existingAsset.crossSection || '',
        intersection: existingAsset.intersection || '',
        pavementState: existingAsset.pavementState || '',
        managingDept: existingAsset.managingDept || '',
        // Data Source Tracking
        dataSource: existingAsset.dataSource || 'manual',
        sourceVersion: existingAsset.sourceVersion || '',
        sourceDate: existingAsset.sourceDate ? new Date(existingAsset.sourceDate) : null,
        lastVerifiedAt: existingAsset.lastVerifiedAt ? new Date(existingAsset.lastVerifiedAt) : null,
      });
    }
  }, [existingAsset, action, reset]);

  // Start drawing when modal opens (for create action)
  useEffect(() => {
    if (opened && action === 'create') {
      startDrawing('road-update');
      // Trigger line draw mode
      setDrawMode('line');
    }

    return () => {
      if (drawingContext === 'road-update') {
        stopDrawing();
      }
    };
  }, [opened, action, startDrawing, stopDrawing, setDrawMode, drawingContext]);

  // Geometry for the form
  const geometry = useMemo<SupportedGeometry | null>(() => {
    if (action === 'create') {
      // Use drawn geometry from road update mode
      if (roadUpdateDrawnFeatures && roadUpdateDrawnFeatures.length > 0) {
        const feature = roadUpdateDrawnFeatures[0];
        if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
          return feature.geometry as SupportedGeometry;
        }
      }
      return null;
    } else if (existingAsset) {
      return existingAsset.geometry;
    }
    return null;
  }, [action, roadUpdateDrawnFeatures, existingAsset]);

  const hasValidGeometry = geometry !== null;

  const handleStartDrawing = () => {
    startDrawing('road-update');
    setDrawMode('line');
  };

  const handleClearDrawing = () => {
    clearDrawing();
  };

  const onSubmit = (data: AssetFormData) => {
    // Batch mode: add to pending changes instead of calling API
    if (onSavePending) {
      if (action === 'create') {
        if (!geometry) {
          showNotification({
            title: 'Geometry Required',
            message: 'Please draw the road geometry on the map.',
            color: 'red',
          });
          return;
        }

        onSavePending({
          action: 'create',
          data: {
            name: data.name || undefined,
            nameJa: data.nameJa || undefined,
            ref: data.ref || undefined,
            localRef: data.localRef || undefined,
            geometry,
            roadType: data.roadType,
            lanes: data.lanes,
            direction: data.direction,
            ward: data.ward || undefined,
            ownerDepartment: data.ownerDepartment || undefined,
            // Road Details
            crossSection: data.crossSection || undefined,
            intersection: data.intersection || undefined,
            pavementState: data.pavementState || undefined,
            managingDept: data.managingDept || undefined,
            // Data Source Tracking
            dataSource: data.dataSource,
            sourceVersion: data.sourceVersion || undefined,
            sourceDate: data.sourceDate ? data.sourceDate.toISOString() : undefined,
            lastVerifiedAt: data.lastVerifiedAt ? data.lastVerifiedAt.toISOString() : undefined,
          },
        });

        showNotification({
          title: 'Change Queued',
          message: 'New road asset will be created when you finalize.',
          color: 'blue',
        });
        handleClose();
      } else if (action === 'modify' && assetId) {
        onSavePending({
          action: 'modify',
          assetId,
          assetLabel: existingAsset ? getRoadAssetLabel(existingAsset) : assetId,
          data: {
            name: data.name || undefined,
            nameJa: data.nameJa || undefined,
            ref: data.ref || undefined,
            localRef: data.localRef || undefined,
            geometry: geometry || undefined,
            roadType: data.roadType,
            lanes: data.lanes,
            direction: data.direction,
            ward: data.ward || undefined,
            ownerDepartment: data.ownerDepartment || undefined,
            // Road Details
            crossSection: data.crossSection || undefined,
            intersection: data.intersection || undefined,
            pavementState: data.pavementState || undefined,
            managingDept: data.managingDept || undefined,
            // Data Source Tracking
            dataSource: data.dataSource,
            sourceVersion: data.sourceVersion || undefined,
            sourceDate: data.sourceDate ? data.sourceDate.toISOString() : undefined,
            lastVerifiedAt: data.lastVerifiedAt ? data.lastVerifiedAt.toISOString() : undefined,
          },
        });

        showNotification({
          title: 'Change Queued',
          message: 'Road asset modification will be applied when you finalize.',
          color: 'blue',
        });
        handleClose();
      } else if (action === 'retire' && assetId) {
        onSavePending({
          action: 'retire',
          assetId,
          assetLabel: existingAsset ? getRoadAssetLabel(existingAsset) : assetId,
          replacedBy: data.replacedBy || undefined,
        });

        showNotification({
          title: 'Change Queued',
          message: 'Road asset will be retired when you finalize.',
          color: 'blue',
        });
        handleClose();
      }
      return;
    }

    // Legacy mode: call API directly (fallback)
    if (action === 'create') {
      if (!geometry) {
        showNotification({
          title: 'Geometry Required',
          message: 'Please draw the road geometry on the map.',
          color: 'red',
        });
        return;
      }

      createAsset.mutate(
        {
          name: data.name || undefined,
          nameJa: data.nameJa || undefined,
          ref: data.ref || undefined,
          localRef: data.localRef || undefined,
          geometry,
          roadType: data.roadType,
          lanes: data.lanes,
          direction: data.direction,
          ward: data.ward || undefined,
          ownerDepartment: data.ownerDepartment || undefined,
          crossSection: data.crossSection || undefined,
          intersection: data.intersection || undefined,
          pavementState: data.pavementState || undefined,
          managingDept: data.managingDept || undefined,
          dataSource: data.dataSource,
          sourceVersion: data.sourceVersion || undefined,
          sourceDate: data.sourceDate ? data.sourceDate.toISOString() : undefined,
          lastVerifiedAt: data.lastVerifiedAt ? data.lastVerifiedAt.toISOString() : undefined,
          eventId,
        },
        {
          onSuccess: () => {
            showNotification({ title: 'Asset Created', message: 'New road asset has been created successfully.', color: 'green' });
            handleClose();
          },
          onError: (error) => {
            showNotification({ title: 'Create Failed', message: error instanceof Error ? error.message : 'Failed to create asset', color: 'red' });
          },
        }
      );
    } else if (action === 'modify' && assetId) {
      updateAsset.mutate(
        {
          id: assetId,
          data: {
            name: data.name || undefined,
            nameJa: data.nameJa || undefined,
            ref: data.ref || undefined,
            localRef: data.localRef || undefined,
            geometry: geometry || undefined,
            roadType: data.roadType,
            lanes: data.lanes,
            direction: data.direction,
            ward: data.ward || undefined,
            ownerDepartment: data.ownerDepartment || undefined,
            crossSection: data.crossSection || undefined,
            intersection: data.intersection || undefined,
            pavementState: data.pavementState || undefined,
            managingDept: data.managingDept || undefined,
            dataSource: data.dataSource,
            sourceVersion: data.sourceVersion || undefined,
            sourceDate: data.sourceDate ? data.sourceDate.toISOString() : undefined,
            lastVerifiedAt: data.lastVerifiedAt ? data.lastVerifiedAt.toISOString() : undefined,
            eventId,
          },
        },
        {
          onSuccess: () => {
            showNotification({ title: 'Asset Updated', message: 'Road asset has been updated successfully.', color: 'green' });
            handleClose();
          },
          onError: (error) => {
            showNotification({ title: 'Update Failed', message: error instanceof Error ? error.message : 'Failed to update asset', color: 'red' });
          },
        }
      );
    } else if (action === 'retire' && assetId) {
      retireAsset.mutate(
        { id: assetId, eventId, replacedBy: data.replacedBy || undefined },
        {
          onSuccess: () => {
            showNotification({ title: 'Asset Retired', message: 'Road asset has been retired successfully.', color: 'green' });
            handleClose();
          },
          onError: (error) => {
            showNotification({ title: 'Retire Failed', message: error instanceof Error ? error.message : 'Failed to retire asset', color: 'red' });
          },
        }
      );
    }
  };

  const handleClose = () => {
    if (drawingContext === 'road-update') {
      stopDrawing();
    }
    reset();
    onClose();
  };

  const getTitle = () => {
    switch (action) {
      case 'create': return 'Create New Road Asset';
      case 'modify': return 'Modify Road Asset';
      case 'retire': return 'Retire Road Asset';
      default: return 'Road Asset';
    }
  };

  const getActionColor = (): 'default' | 'destructive' | 'outline' => {
    switch (action) {
      case 'retire': return 'destructive';
      default: return 'default';
    }
  };

  if (isLoadingAsset && action !== 'create') {
    return (
      <Dialog open={opened} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-lg" style={{ zIndex: 400 }}>
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
          </DialogHeader>
          <Center h={200}>
            <Loader size="lg" />
          </Center>
        </DialogContent>
      </Dialog>
    );
  }

  if (action !== 'create' && !existingAsset && assetId) {
    return (
      <Dialog open={opened} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-lg" style={{ zIndex: 400 }}>
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <IconAlertCircle size={16} />
            <AlertDescription>Asset not found</AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={opened} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ zIndex: 400 }}>
        <DialogHeader>
          <DialogTitle>
            <Group gap="xs">
              <span>{getTitle()}</span>
              <Badge variant="secondary" className="text-xs">
                {action}
              </Badge>
            </Group>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap="md">
            {/* Existing asset info (for modify/retire) */}
            {existingAsset && (
              <Paper p="sm" withBorder>
                <Text size="sm" fw={500}>
                  {getRoadAssetLabel(existingAsset)}
                </Text>
                <Group gap="xs" mt={4}>
                  <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-800">
                    {existingAsset.roadType}
                  </Badge>
                  {existingAsset.lanes && (
                    <Text size="xs" c="dimmed">
                      {existingAsset.lanes} lanes
                    </Text>
                  )}
                </Group>
              </Paper>
            )}

            {/* Retire action - simplified view */}
            {action === 'retire' ? (
              <>
                <Alert variant="destructive">
                  <IconTrashX size={16} />
                  <AlertDescription>
                    This will mark the asset as <strong>inactive</strong> and set its valid-to date to today.
                    This action cannot be easily undone.
                  </AlertDescription>
                </Alert>

                <Controller
                  name="replacedBy"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <Label>Replaced By (Optional)</Label>
                      <p className="text-xs text-muted-foreground mb-1">If this asset is being replaced by another, select the new asset</p>
                      <Select value={field.value || undefined} onValueChange={(val) => field.onChange(val || '')}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select replacement asset" />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: 500 }}>
                          {availableAssets
                            .filter((a: RoadAsset) => a.id !== assetId)
                            .map((a: RoadAsset) => (
                              <SelectItem key={a.id} value={a.id}>
                                {getRoadAssetLabel(a)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
              </>
            ) : (
              <>
                {/* Geometry section (for create) */}
                {action === 'create' && (
                  <>
                    <Divider label="Geometry" />
                    <Paper p="sm" withBorder>
                      {hasValidGeometry ? (
                        <Group justify="space-between">
                          <Group gap="xs">
                            <IconMapPin size={16} color="green" />
                            <Text size="sm" c="green">
                              Geometry drawn ({geometry?.type})
                            </Text>
                          </Group>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={handleClearDrawing}
                          >
                            Clear
                          </Button>
                        </Group>
                      ) : (
                        <Stack gap="xs" align="center">
                          <Text size="sm" c="dimmed">
                            Draw the road geometry on the map
                          </Text>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleStartDrawing}
                          >
                            <IconMapPin size={14} className="mr-2" />
                            Start Drawing
                          </Button>
                        </Stack>
                      )}
                    </Paper>
                  </>
                )}

                <Divider label="Properties" />

                {/* Name fields */}
                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Label>Name</Label>
                        <Input placeholder="Road name" {...field} />
                      </div>
                    )}
                  />
                  <Controller
                    name="nameJa"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Label>Name (Japanese)</Label>
                        <Input placeholder="日本語名" {...field} />
                      </div>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="ref"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Label>Route Reference</Label>
                        <Input placeholder="e.g., 国道23号" {...field} />
                      </div>
                    )}
                  />
                  <Controller
                    name="localRef"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Label>Local Reference</Label>
                        <Input placeholder="e.g., 市道1234号" {...field} />
                      </div>
                    )}
                  />
                </div>

                {/* Road properties */}
                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="roadType"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <div>
                        <Label>Road Type *</Label>
                        <Select value={field.value} onValueChange={(val) => field.onChange(val || 'local')}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent style={{ zIndex: 500 }}>
                            {roadTypeOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  />
                  <Controller
                    name="lanes"
                    control={control}
                    rules={{ required: true, min: 1 }}
                    render={({ field }) => (
                      <div>
                        <Label>Lanes *</Label>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </div>
                    )}
                  />
                </div>

                <Controller
                  name="direction"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <div>
                      <Label>Direction *</Label>
                      <Select value={field.value} onValueChange={(val) => field.onChange(val || 'two-way')}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: 500 }}>
                          {directionOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />

                {/* Location info */}
                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="ward"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Label>Ward</Label>
                        <Input placeholder="e.g., 中区" {...field} />
                      </div>
                    )}
                  />
                  <Controller
                    name="ownerDepartment"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Label>Owner Department</Label>
                        <Input placeholder="Managing department" {...field} />
                      </div>
                    )}
                  />
                </div>

                {/* Road Details Group */}
                <Divider label="Road Details" className="mt-4" />

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="crossSection"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Label>Cross Section</Label>
                        <p className="text-xs text-muted-foreground">Road cross-section type</p>
                        <Input placeholder="e.g., 幅員12m" {...field} />
                      </div>
                    )}
                  />
                  <Controller
                    name="managingDept"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Label>Managing Department</Label>
                        <p className="text-xs text-muted-foreground">Department managing this road</p>
                        <Input placeholder="e.g., 道路管理課" {...field} />
                      </div>
                    )}
                  />
                </div>

                <Controller
                  name="intersection"
                  control={control}
                  rules={{ maxLength: { value: 255, message: 'Max 255 characters' } }}
                  render={({ field, fieldState }) => (
                    <div>
                      <Label>Intersection</Label>
                      <p className="text-xs text-muted-foreground">Notable intersections or junctions (max 255 chars)</p>
                      <Textarea
                        placeholder="Intersection description or nearby intersections"
                        rows={2}
                        {...field}
                      />
                      {fieldState.error?.message && <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>}
                    </div>
                  )}
                />

                <Controller
                  name="pavementState"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <Label>Pavement State</Label>
                      <p className="text-xs text-muted-foreground">Current pavement condition</p>
                      <Input placeholder="e.g., Good, Fair, Poor" {...field} />
                    </div>
                  )}
                />

                {/* Data Source Tracking Group */}
                <Divider label="Data Source Tracking" className="mt-4" />

                <Controller
                  name="dataSource"
                  control={control}
                  rules={{ required: 'Data source is required' }}
                  render={({ field }) => (
                    <div>
                      <Label>Data Source *</Label>
                      <p className="text-xs text-muted-foreground">Origin of this asset data</p>
                      <Select value={field.value} onValueChange={(val) => field.onChange(val || 'manual')}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: 500 }}>
                          {dataSourceOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="sourceVersion"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Label>Source Version</Label>
                        <p className="text-xs text-muted-foreground">Version identifier of the data source</p>
                        <Input placeholder="e.g., v2024.1, OSM-2024-01" {...field} />
                      </div>
                    )}
                  />
                  <Controller
                    name="sourceDate"
                    control={control}
                    render={({ field }) => (
                      <DatePickerInput
                        label="Source Date"
                        placeholder="Select date"
                        description="Publication date of the source data"
                        clearable
                        value={field.value}
                        onChange={field.onChange}
                        popoverProps={{ zIndex: 500 }}
                      />
                    )}
                  />
                </div>

                <Controller
                  name="lastVerifiedAt"
                  control={control}
                  render={({ field }) => (
                    <DatePickerInput
                      label="Last Verified At"
                      placeholder="Select date"
                      description="When this data was last verified as accurate"
                      clearable
                      value={field.value}
                      onChange={field.onChange}
                      popoverProps={{ zIndex: 500 }}
                    />
                  )}
                />
              </>
            )}

            {/* Action buttons */}
            <Group justify="flex-end" mt="md">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={getActionColor()}
                disabled={(action === 'create' && !hasValidGeometry) || isLoading}
              >
                {action === 'retire' ? <IconTrashX size={16} className="mr-2" /> : <IconCheck size={16} className="mr-2" />}
                {isLoading ? 'Saving...' : action === 'create'
                  ? 'Create Asset'
                  : action === 'modify'
                  ? 'Save Changes'
                  : 'Retire Asset'}
              </Button>
            </Group>
          </Stack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
