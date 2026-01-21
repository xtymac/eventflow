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
    Card,
    Tabs,
    Badge,
    Loader,
    Alert,
    ScrollArea,
    Paper,
    Center,
    Button,
    Box,
    Divider,
    ThemeIcon,
    Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
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
        <ScrollArea h="calc(100vh - 400px)" type="auto" offsetScrollbars>
            <Stack gap="xs">
                {features.slice(0, 100).map((feature, index) => {
                    const props = feature.properties as FeatureProperties | null;
                    const hasGeometry = !!feature.geometry;
                    return (
                        <Card
                            key={props?.id || index}
                            withBorder
                            padding="xs"
                            radius="sm"
                            onClick={() => hasGeometry && onFeatureClick?.(feature)}
                            style={{
                                cursor: hasGeometry && onFeatureClick ? 'pointer' : 'default',
                                transition: 'background-color 0.2s',
                            }}
                            className="feature-card"
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
                                            <Badge size="xs" variant="dot" color="gray">
                                                {props.ward}
                                            </Badge>
                                        )}
                                    </Group>
                                </Stack>
                                {props?.roadType && (
                                    <Badge size="xs" variant="light">
                                        {props.roadType}
                                    </Badge>
                                )}
                            </Group>
                        </Card>
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

function ChangeCountCard({ icon, count, label, color }: ChangeCountCardProps) {
    return (
        <Paper
            withBorder
            p="xs"
            radius="md"
            flex={1}
            style={{
                borderColor: `var(--mantine-color-${color}-3)`,
                backgroundColor: `var(--mantine-color-${color}-0)`,
                textAlign: 'center',
            }}
        >
            <Stack gap={4} align="center">
                <Group gap={4}>
                    <ThemeIcon size="sm" color={color} variant="transparent">
                        {icon}
                    </ThemeIcon>
                    <Text fw={700} size="md" ff="monospace" c={`${color}.8`}>
                        {count.toLocaleString()}
                    </Text>
                </Group>
                <Text size="xs" c={`${color}.8`}>{label}</Text>
            </Stack>
        </Paper>
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
    const [activeTab, setActiveTab] = useState<string | null>('updated');

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
            notifications.show({
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
            notifications.show({
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
                <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} size="xs" onClick={onBack} mb="xs" px={0}>
                    Back to History
                </Button>
                <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                        <Title order={5}>Version #{displayNumber}</Title>
                        <Group gap="xs">
                            <Badge
                                color={version.status === 'published' ? 'green' : 'orange'}
                                variant="light"
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
                <Alert color="yellow" icon={<IconInfoCircle size={16} />}>
                    Details not available for this version.
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
                        <Alert color="blue" variant="light">
                            No road data changes in this version.
                        </Alert>
                    )}

                    {/* List Tabs */}
                    {hasChanges && (
                        <Stack flex={1} style={{ overflow: 'hidden' }}>
                            <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md" defaultValue="updated">
                                <Tabs.List grow>
                                    <Tabs.Tab value="updated" disabled={diff.stats.updatedCount === 0}>
                                        Updated
                                    </Tabs.Tab>
                                    <Tabs.Tab value="added" disabled={diff.stats.addedCount === 0}>
                                        Added
                                    </Tabs.Tab>
                                    <Tabs.Tab value="deactivated" disabled={diff.stats.deactivatedCount === 0}>
                                        Removed
                                    </Tabs.Tab>
                                </Tabs.List>

                                <Tabs.Panel value="updated" pt="sm">
                                    <LocalFeatureTable
                                        features={diff.updated}
                                        emptyMessage="No updates"
                                        onFeatureClick={handleFeatureClick}
                                    />
                                </Tabs.Panel>
                                <Tabs.Panel value="added" pt="sm">
                                    <LocalFeatureTable
                                        features={diff.added}
                                        emptyMessage="No additions"
                                        onFeatureClick={handleFeatureClick}
                                    />
                                </Tabs.Panel>
                                <Tabs.Panel value="deactivated" pt="sm">
                                    <LocalFeatureTable
                                        features={diff.deactivated}
                                        emptyMessage="No removals"
                                        onFeatureClick={handleFeatureClick}
                                    />
                                </Tabs.Panel>
                            </Tabs>
                        </Stack>
                    )}
                </>
            )}

            {/* Footer Action */}
            <Box pt="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                <Button
                    fullWidth
                    onClick={handlePreviewAll}
                    disabled={!hasChanges}
                    leftSection={<IconMap size={16} />}
                >
                    Preview All on Map
                </Button>
            </Box>
        </Stack>
    );
}
