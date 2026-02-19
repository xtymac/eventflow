/**
 * Import Version Details Component
 *
 * Displays the details of a specific import version.
 * Intended to be used in a drill-down view within the sidebar.
 */

import { useState } from 'react';
import {
    Stack,
    Text,
    Group,
    Center,
    Box,
    Divider,
    Title,
    Loader,
} from '@/components/shims';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showNotification } from '@/lib/toast';
import {
    IconPlus,
    IconPencil,
    IconArchive,
    IconInfoCircle,
    IconMap,
    IconArrowLeft,
} from '@tabler/icons-react';
import { useHistoricalDiff, type ImportVersion } from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';
import { useMapStore } from '../../../stores/mapStore';
import type { Feature } from 'geojson';

// --- Helper Components ---

interface FeatureProperties {
    id?: string;
    name?: string;
    roadType?: string;
    ward?: string;
    [key: string]: unknown;
}

interface LocalFeatureTableProps {
    features: Feature[];
    emptyMessage: string;
    onFeatureClick?: (feature: Feature) => void;
}

function LocalFeatureTable({ features, emptyMessage, onFeatureClick }: LocalFeatureTableProps) {
    if (features.length === 0) {
        return (
            <Text c="dimmed" ta="center" py="lg" size="sm">
                {emptyMessage}
            </Text>
        );
    }

    return (
        <ScrollArea className="h-[calc(100vh-400px)]">
            <Stack gap="xs">
                {features.slice(0, 100).map((feature, index) => {
                    const props = feature.properties as FeatureProperties | null;
                    const hasGeometry = !!feature.geometry;
                    return (
                        <div
                            key={props?.id || index}
                            className="border rounded-sm p-2 feature-card"
                            onClick={() => hasGeometry && onFeatureClick?.(feature)}
                            style={{
                                cursor: hasGeometry && onFeatureClick ? 'pointer' : 'default',
                                transition: 'background-color 0.2s',
                            }}
                        >
                            <Group justify="space-between" wrap="nowrap">
                                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                                    <Text size="sm" fw={500} lineClamp={1}>
                                        {props?.name || 'Unnamed Road'}
                                    </Text>
                                    <Group gap="xs">
                                        <Text size="xs" c="dimmed" ff="monospace">
                                            {props?.id || '-'}
                                        </Text>
                                        {props?.ward && (
                                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                {props.ward}
                                            </Badge>
                                        )}
                                    </Group>
                                </Stack>
                                {props?.roadType && (
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                        {props.roadType}
                                    </Badge>
                                )}
                            </Group>
                        </div>
                    );
                })}
                {features.length > 100 && (
                    <Text size="xs" c="dimmed" ta="center" mt="sm">
                        Showing first 100 of {features.length} features
                    </Text>
                )}
            </Stack>
        </ScrollArea>
    );
}

interface ChangeCountCardProps {
    icon: React.ReactNode;
    count: number;
    label: string;
    color: string;
}

const COLOR_MAP: Record<string, { border: string; bg: string; text: string }> = {
    green: { border: 'border-green-300', bg: 'bg-green-50', text: 'text-green-800' },
    blue: { border: 'border-blue-300', bg: 'bg-blue-50', text: 'text-blue-800' },
    orange: { border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-800' },
};

function ChangeCountCard({ icon, count, label, color }: ChangeCountCardProps) {
    const colors = COLOR_MAP[color] || COLOR_MAP.blue;
    return (
        <div
            className={`border rounded-md p-2 flex-1 text-center ${colors.border} ${colors.bg}`}
        >
            <Stack gap={4} align="center">
                <Group gap={4}>
                    <div className={colors.text}>
                        {icon}
                    </div>
                    <Text fw={700} size="md" ff="monospace" className={colors.text}>
                        {count.toLocaleString()}
                    </Text>
                </Group>
                <Text size="xs" className={colors.text}>{label}</Text>
            </Stack>
        </div>
    );
}

// --- Main Component ---

interface ImportVersionDetailsProps {
    version: ImportVersion;
    displayNumber: number;
    onBack: () => void;
}

export function ImportVersionDetails({
    version,
    displayNumber,
    onBack,
}: ImportVersionDetailsProps) {
    const { data: diffData, isLoading, error } = useHistoricalDiff(version.id);
    const [activeTab, setActiveTab] = useState<string>('updated');

    const { closeImportExportSidebar, enterHistoricalPreview } = useUIStore();
    const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);

    const diff = diffData?.data;

    // Collect all modified features with geometry
    const getAllModifiedFeatures = (): Feature[] => {
        if (!diff) return [];
        const allFeatures: Feature[] = [];

        // Helper to add type
        const addType = (list: Feature[], type: string) => {
            return list.filter(f => f.geometry).map(f => ({
                ...f,
                properties: { ...f.properties, _changeType: type }
            }));
        };

        allFeatures.push(...addType(diff.updated, 'updated'));
        allFeatures.push(...addType(diff.added, 'added'));
        allFeatures.push(...addType(diff.deactivated, 'removed'));

        return allFeatures;
    };

    const handleFeatureClick = (feature: Feature) => {
        if (!feature.geometry) {
            showNotification({
                title: 'Cannot highlight',
                message: 'This feature has no geometry data',
                color: 'yellow',
            });
            return;
        }

        const allFeatures = getAllModifiedFeatures();
        const props = feature.properties as FeatureProperties | null;
        const label = props?.name || props?.id || 'Unnamed Road';

        // Highlight on map
        setImportAreaHighlight({
            geometry: feature.geometry,
            label,
        });

        // Enter historical preview mode
        // Reorder so clicked is first
        const featureIndex = allFeatures.findIndex(
            (f) => f.properties?.id === feature.properties?.id
        );
        const reordered = [
            ...allFeatures.slice(featureIndex >= 0 ? featureIndex : 0),
            ...allFeatures.slice(0, featureIndex >= 0 ? featureIndex : 0),
        ];

        enterHistoricalPreview(version.id, displayNumber, reordered);
        closeImportExportSidebar();
    };

    const handlePreviewAll = () => {
        const allFeatures = getAllModifiedFeatures();
        if (allFeatures.length === 0) {
            showNotification({
                title: 'No changes',
                message: 'No map changes to preview',
                color: 'yellow',
            });
            return;
        }

        const first = allFeatures[0];
        const props = first.properties as FeatureProperties | null;
        setImportAreaHighlight({
            geometry: first.geometry!,
            label: props?.name || 'Preview',
        });

        enterHistoricalPreview(version.id, displayNumber, allFeatures);
        closeImportExportSidebar();
    };

    const hasNoChanges = diff &&
        diff.stats.addedCount === 0 &&
        diff.stats.updatedCount === 0 &&
        diff.stats.deactivatedCount === 0;

    const hasChanges = diff && !hasNoChanges;

    return (
        <Stack gap="md" h="100%" style={{ overflow: 'hidden' }}>
            {/* Header */}
            <Box>
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-1 px-0">
                    <IconArrowLeft size={16} className="mr-1" />
                    Back to History
                </Button>
                <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                        <Title order={5}>Version #{displayNumber}</Title>
                        <Group gap="xs">
                            <Badge
                                className={
                                    version.status === 'published'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-orange-100 text-orange-800'
                                }
                            >
                                {version.status}
                            </Badge>
                            <Text size="xs" c="dimmed">
                                {new Date(version.publishedAt || version.uploadedAt).toLocaleDateString()}
                            </Text>
                        </Group>
                    </Stack>
                </Group>
            </Box>

            <Divider />

            {isLoading && (
                <Center py="xl">
                    <Loader size="sm" />
                </Center>
            )}

            {error && (
                <Alert>
                    <IconInfoCircle size={16} />
                    <AlertDescription>
                        Details not available for this version.
                    </AlertDescription>
                </Alert>
            )}

            {diff && (
                <>
                    {/* Stats */}
                    <Group gap="xs" grow>
                        <ChangeCountCard
                            icon={<IconPlus size={14} />}
                            count={diff.stats.addedCount}
                            label="Added"
                            color="green"
                        />
                        <ChangeCountCard
                            icon={<IconPencil size={14} />}
                            count={diff.stats.updatedCount}
                            label="Updated"
                            color="blue"
                        />
                        <ChangeCountCard
                            icon={<IconArchive size={14} />}
                            count={diff.stats.deactivatedCount}
                            label="Removed"
                            color="orange"
                        />
                    </Group>

                    {hasNoChanges && (
                        <Alert>
                            <AlertDescription>
                                No road data changes in this version.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* List Tabs */}
                    {hasChanges && (
                        <Stack style={{ flex: 1, overflow: 'hidden' }}>
                            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="updated">
                                <TabsList className="w-full">
                                    <TabsTrigger value="updated" disabled={diff.stats.updatedCount === 0} className="flex-1">
                                        Updated
                                    </TabsTrigger>
                                    <TabsTrigger value="added" disabled={diff.stats.addedCount === 0} className="flex-1">
                                        Added
                                    </TabsTrigger>
                                    <TabsTrigger value="deactivated" disabled={diff.stats.deactivatedCount === 0} className="flex-1">
                                        Removed
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="updated" className="pt-2">
                                    <LocalFeatureTable
                                        features={diff.updated}
                                        emptyMessage="No updates"
                                        onFeatureClick={handleFeatureClick}
                                    />
                                </TabsContent>
                                <TabsContent value="added" className="pt-2">
                                    <LocalFeatureTable
                                        features={diff.added}
                                        emptyMessage="No additions"
                                        onFeatureClick={handleFeatureClick}
                                    />
                                </TabsContent>
                                <TabsContent value="deactivated" className="pt-2">
                                    <LocalFeatureTable
                                        features={diff.deactivated}
                                        emptyMessage="No removals"
                                        onFeatureClick={handleFeatureClick}
                                    />
                                </TabsContent>
                            </Tabs>
                        </Stack>
                    )}
                </>
            )}

            {/* Footer Action */}
            <Box pt="md" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                <Button
                    className="w-full"
                    onClick={handlePreviewAll}
                    disabled={!hasChanges}
                >
                    <IconMap size={16} className="mr-1" />
                    Preview All on Map
                </Button>
            </Box>
        </Stack>
    );
}
