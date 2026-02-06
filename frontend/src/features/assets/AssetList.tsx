import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Stack,
  Card,
  Text,
  Badge,
  Group,
  Loader,
  Center,
  ActionIcon,
  Tabs,
  Box,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconTree, IconLeaf, IconRuler2, IconDroplet } from '@tabler/icons-react';
import * as turf from '@turf/turf';
import { useStreetTreesInBbox, useParkFacilitiesInBbox, usePavementSectionsInBbox, usePumpStationsInBbox, useGreenSpacesInBbox } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { StreetTreeAsset, ParkFacilityAsset, PavementSectionAsset, PumpStationAsset, GreenSpaceAsset } from '@nagoya/shared';
import type { Feature } from 'geojson';

const TREE_CATEGORY_COLORS: Record<string, string> = {
  deciduous: 'green',
  evergreen: 'teal',
  conifer: 'lime',
  palmLike: 'orange',
  shrub: 'yellow',
};

const TREE_CATEGORY_LABELS: Record<string, string> = {
  deciduous: '落葉樹',
  evergreen: '常緑樹',
  conifer: '針葉樹',
  palmLike: 'ヤシ類',
  shrub: '低木',
};

const PARK_FACILITY_COLORS: Record<string, string> = {
  toilet: 'blue',
  playground: 'orange',
  bench: 'gray',
  shelter: 'teal',
  fence: 'dark',
  gate: 'dark',
  drainage: 'cyan',
  lighting: 'yellow',
  waterFountain: 'blue',
  signBoard: 'indigo',
  pavement: 'gray',
  sportsFacility: 'lime',
  building: 'violet',
  other: 'gray',
};

const PAVEMENT_TYPE_COLORS: Record<string, string> = {
  asphalt: 'dark',
  concrete: 'gray',
  interlocking: 'orange',
  gravel: 'yellow',
  other: 'gray',
};

const PUMP_CATEGORY_COLORS: Record<string, string> = {
  stormwater: 'blue',
  sewage: 'violet',
  irrigation: 'green',
  combined: 'cyan',
};

const PUMP_CATEGORY_LABELS: Record<string, string> = {
  stormwater: '雨水',
  sewage: '汚水',
  irrigation: '灌漑',
  combined: '合流',
};

// Semantic emoji for visual distinction from workorder cards
const FACILITY_EMOJI: Record<string, string> = {
  toilet: '\u{1F6BB}', playground: '\u{1F6DD}', bench: '\u{1FA91}', shelter: '\u26E9\uFE0F',
  fence: '\u{1F6A7}', gate: '\u{1F6AA}', drainage: '\u{1F30A}', lighting: '\u{1F4A1}',
  waterFountain: '\u26F2', signBoard: '\u{1FAA7}', pavement: '\u2B1C',
  sportsFacility: '\u26BD', building: '\u{1F3E2}', other: '\u{1F4E6}',
};

const TREE_EMOJI: Record<string, string> = {
  deciduous: '\u{1F333}', evergreen: '\u{1F332}', conifer: '\u{1F332}',
  palmLike: '\u{1F334}', shrub: '\u{1F33F}',
};

const PUMP_EMOJI: Record<string, string> = {
  stormwater: '\u{1F4A7}', sewage: '\u{1F7E3}', irrigation: '\u{1F33E}', combined: '\u{1F504}',
};

// Build a wide bbox around a center point (~10km radius) for the asset list.
// This ensures the list always finds nearby items even when the viewport
// is zoomed into an area without data.
function wideBboxFromCenter(center: [number, number] | null): string | null {
  if (!center) return null;
  const [lng, lat] = center;
  // ~0.1 degrees ≈ 10km at Nagoya latitude
  const pad = 0.1;
  return `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`;
}

export function AssetList() {
  // Local UI state
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Tab scroll state
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { mapBbox, mapCenter, setFlyToGeometry, selectAsset, selectedAssetId } = useUIStore();

  // Use a wide bbox for the list queries so we always find nearby items,
  // even when the viewport is focused on an area without assets.
  const listBbox = useMemo(() => {
    return wideBboxFromCenter(mapCenter) ?? mapBbox ?? null;
  }, [mapCenter, mapBbox]);

  // Fetch green spaces for park grouping headers (need high limit to find all parks by ID)
  // There are ~1300 parks in the typical bbox, so we need limit > that to ensure all are fetched
  const { data: greenSpacesData } = useGreenSpacesInBbox(
    listBbox,
    { greenSpaceType: 'park', limit: 2000 },
    { enabled: !!listBbox }
  );

  // Fetch asset data for tabs — use wide bbox, no minimum zoom restriction
  const { data: parkFacilitiesData, isLoading: isLoadingParkFacilities } = useParkFacilitiesInBbox(
    listBbox,
    undefined,
    { enabled: !!listBbox }
  );
  const { data: streetTreesData, isLoading: isLoadingStreetTrees } = useStreetTreesInBbox(
    listBbox,
    undefined,
    { enabled: !!listBbox }
  );
  const { data: pavementSectionsData, isLoading: isLoadingPavementSections } = usePavementSectionsInBbox(
    listBbox,
    undefined,
    { enabled: !!listBbox }
  );
  const { data: pumpStationsData, isLoading: isLoadingPumpStations } = usePumpStationsInBbox(
    listBbox,
    undefined,
    { enabled: !!listBbox }
  );

  // Sort park facilities by distance from map center
  const sortedParkFacilities = useMemo(() => {
    if (!parkFacilitiesData?.features || !mapCenter) return parkFacilitiesData?.features ?? [];
    return [...parkFacilitiesData.features].sort((a, b) => {
      try {
        const centerPoint = turf.point(mapCenter);
        const centerA = turf.center(a);
        const centerB = turf.center(b);
        return turf.distance(centerPoint, centerA) - turf.distance(centerPoint, centerB);
      } catch {
        return 0;
      }
    });
  }, [parkFacilitiesData?.features, mapCenter]);

  // Sort street trees by distance from map center
  const sortedStreetTrees = useMemo(() => {
    if (!streetTreesData?.features || !mapCenter) return streetTreesData?.features ?? [];
    return [...streetTreesData.features].sort((a, b) => {
      try {
        const centerPoint = turf.point(mapCenter);
        return turf.distance(centerPoint, a) - turf.distance(centerPoint, b);
      } catch {
        return 0;
      }
    });
  }, [streetTreesData?.features, mapCenter]);

  // Sort pavement sections by distance from map center
  const sortedPavementSections = useMemo(() => {
    if (!pavementSectionsData?.features || !mapCenter) return pavementSectionsData?.features ?? [];
    return [...pavementSectionsData.features].sort((a, b) => {
      try {
        const centerPoint = turf.point(mapCenter);
        const centerA = turf.center(a);
        const centerB = turf.center(b);
        return turf.distance(centerPoint, centerA) - turf.distance(centerPoint, centerB);
      } catch {
        return 0;
      }
    });
  }, [pavementSectionsData?.features, mapCenter]);

  // Sort pump stations by distance from map center
  const sortedPumpStations = useMemo(() => {
    if (!pumpStationsData?.features || !mapCenter) return pumpStationsData?.features ?? [];
    return [...pumpStationsData.features].sort((a, b) => {
      try {
        const centerPoint = turf.point(mapCenter);
        const centerA = turf.center(a);
        const centerB = turf.center(b);
        return turf.distance(centerPoint, centerA) - turf.distance(centerPoint, centerB);
      } catch {
        return 0;
      }
    });
  }, [pumpStationsData?.features, mapCenter]);

  // Build a lookup map from greenSpaceRef → GreenSpaceAsset for park headers
  const greenSpaceMap = useMemo(() => {
    const map = new Map<string, { asset: GreenSpaceAsset; feature: Feature }>();
    if (!greenSpacesData?.features) return map;
    for (const f of greenSpacesData.features) {
      const gs = f.properties as GreenSpaceAsset;
      map.set(gs.id, { asset: gs, feature: f as Feature });
    }
    return map;
  }, [greenSpacesData?.features]);

  // Group park facilities by their parent green space
  const parkGroups = useMemo(() => {
    const groups = new Map<string, { parkName: string; feature: Feature | null; facilities: typeof sortedParkFacilities }>();
    for (const f of sortedParkFacilities) {
      const pf = f.properties as ParkFacilityAsset;
      const ref = pf.greenSpaceRef || '__unknown__';
      if (!groups.has(ref)) {
        const gs = greenSpaceMap.get(ref);
        const parkName = gs?.asset.displayName || gs?.asset.nameJa || gs?.asset.name || '公園';
        groups.set(ref, { parkName, feature: gs?.feature ?? null, facilities: [] });
      }
      groups.get(ref)!.facilities.push(f);
    }
    return Array.from(groups.entries()).map(([id, g]) => ({ parkId: id, ...g }));
  }, [sortedParkFacilities, greenSpaceMap]);

  // Strip park name prefix from facility name for cleaner display
  const stripParkPrefix = (facilityName: string, parkName: string): string => {
    // Try removing "ParkName " or "ParkName　" prefix
    if (facilityName.startsWith(parkName + ' ')) return facilityName.slice(parkName.length + 1);
    if (facilityName.startsWith(parkName + '\u3000')) return facilityName.slice(parkName.length + 1);
    return facilityName;
  };

  // Tab scroll detection (must be before early returns to follow hooks rules)
  // Show arrows when a tab is hidden or only partially visible (less than threshold)
  const updateScrollState = () => {
    const container = tabsScrollRef.current;
    if (!container) return;

    const { scrollLeft, clientWidth } = container;
    const containerRight = scrollLeft + clientWidth;
    const VISIBLE_THRESHOLD = 40; // Minimum visible pixels to be considered "clickable"

    // Check if any tab is hidden or mostly hidden on either side
    let hasHiddenLeft = false;
    let hasHiddenRight = false;

    Object.values(tabRefs.current).forEach((tab) => {
      if (!tab) return;
      const tabLeft = tab.offsetLeft;
      const tabRight = tabLeft + tab.offsetWidth;

      // Calculate visible portion of tab
      const visibleLeft = Math.max(tabLeft, scrollLeft);
      const visibleRight = Math.min(tabRight, containerRight);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);

      // Tab is on the left and not enough is visible
      if (tabLeft < scrollLeft && visibleWidth < VISIBLE_THRESHOLD) {
        hasHiddenLeft = true;
      }
      // Tab is on the right and not enough is visible
      if (tabRight > containerRight && visibleWidth < VISIBLE_THRESHOLD) {
        hasHiddenRight = true;
      }
    });

    setCanScrollLeft(hasHiddenLeft);
    setCanScrollRight(hasHiddenRight);
  };

  // Check scroll state on mount and when data changes
  useEffect(() => {
    updateScrollState();
    // Also check after a short delay to ensure layout is complete
    const timer = setTimeout(updateScrollState, 100);
    return () => clearTimeout(timer);
  }, [sortedParkFacilities.length, sortedStreetTrees.length, sortedPavementSections.length, sortedPumpStations.length]);

  // Tab scroll handlers
  const handleScrollLeft = () => {
    const container = tabsScrollRef.current;
    if (container) {
      container.scrollBy({ left: -120, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    const container = tabsScrollRef.current;
    if (container) {
      container.scrollBy({ left: 120, behavior: 'smooth' });
    }
  };

  // Tab auto-scroll handler
  const handleTabClick = (tabValue: string) => {
    const tabElement = tabRefs.current[tabValue];
    if (tabElement) {
      tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  return (
    <Tabs defaultValue="park-facilities">
      <Group gap={4} mb="md" wrap="nowrap" align="center">
        {canScrollLeft && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleScrollLeft}
            style={{ flexShrink: 0 }}
            aria-label="Scroll tabs left"
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
        )}
        <Box
          ref={tabsScrollRef}
          className="tabs-scroll-container"
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none', // Firefox
          }}
          onScroll={updateScrollState}
        >
          <Tabs.List style={{ flexWrap: 'nowrap', minWidth: 'max-content' }}>
            <Tabs.Tab
              value="park-facilities"
              leftSection={<IconTree size={14} />}
              ref={(el) => { tabRefs.current['park-facilities'] = el; }}
              onClick={() => handleTabClick('park-facilities')}
            >
              公園 ({sortedParkFacilities.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="street-trees"
              leftSection={<IconLeaf size={14} />}
              ref={(el) => { tabRefs.current['street-trees'] = el; }}
              onClick={() => handleTabClick('street-trees')}
            >
              街路樹 ({sortedStreetTrees.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="pavement-sections"
              leftSection={<IconRuler2 size={14} />}
              ref={(el) => { tabRefs.current['pavement-sections'] = el; }}
              onClick={() => handleTabClick('pavement-sections')}
            >
              道路舗装 ({sortedPavementSections.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="pump-stations"
              leftSection={<IconDroplet size={14} />}
              ref={(el) => { tabRefs.current['pump-stations'] = el; }}
              onClick={() => handleTabClick('pump-stations')}
            >
              ポンプ施設 ({sortedPumpStations.length})
            </Tabs.Tab>
          </Tabs.List>
        </Box>
        {canScrollRight && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleScrollRight}
            style={{ flexShrink: 0 }}
            aria-label="Scroll tabs right"
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        )}
      </Group>

      <Tabs.Panel value="park-facilities">
        <Stack gap="xs">
          {isLoadingParkFacilities ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : parkGroups.length === 0 ? (
            <Text c="dimmed" ta="center" py="lg">
              周辺に公園施設がありません
            </Text>
          ) : (
            parkGroups.map((group) => (
              <Box key={group.parkId}>
                {/* Park header */}
                <Group
                  gap="xs"
                  mb={6}
                  mt="xs"
                  px="xs"
                  py={4}
                  style={{
                    cursor: group.feature ? 'pointer' : 'default',
                    borderRadius: 'var(--mantine-radius-sm)',
                    backgroundColor: selectedAssetId === group.parkId ? 'var(--mantine-color-teal-0)' : undefined,
                    border: selectedAssetId === group.parkId ? '1px solid var(--mantine-color-teal-5)' : '1px solid transparent',
                  }}
                  onClick={() => {
                    if (group.feature?.geometry) {
                      selectAsset(group.parkId, 'green-space', group.feature.geometry);
                      setFlyToGeometry(group.feature.geometry, true);
                    }
                  }}
                >
                  <Text fw={700} size="sm">
                    {'\u{1F3DE}\uFE0F'} {group.parkName}
                  </Text>
                  <Badge size="xs" variant="light" color="green">
                    {group.facilities.length}
                  </Badge>
                </Group>

                {/* Facility cards under this park */}
                <Stack gap={4} ml="md">
                  {group.facilities.map((feature) => {
                    const pf = feature.properties as ParkFacilityAsset;
                    const rawName = pf.name || pf.facilityId || '施設';
                    const shortName = stripParkPrefix(rawName, group.parkName);
                    const emoji = FACILITY_EMOJI[pf.category] || '\u{1F4E6}';

                    return (
                      <Card
                        key={pf.id}
                        padding="xs"
                        radius="sm"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                          borderColor: selectedAssetId === pf.id ? 'var(--mantine-color-violet-5)' : undefined,
                          backgroundColor: selectedAssetId === pf.id ? 'var(--mantine-color-violet-0)' : undefined,
                        }}
                        className="asset-card-hover"
                        onClick={() => {
                          selectAsset(pf.id, 'park-facility', feature.geometry);
                          if (feature.geometry) setFlyToGeometry(feature.geometry, true);
                        }}
                      >
                        <Group gap="xs" wrap="nowrap" align="center">
                          <Text size="md" style={{ flexShrink: 0, lineHeight: 1 }}>
                            {emoji}
                          </Text>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text fw={500} size="sm" lineClamp={1}>
                              {shortName}
                            </Text>
                            <Badge color={PARK_FACILITY_COLORS[pf.category] || 'gray'} size="xs" mt={2}>
                              {pf.category}
                            </Badge>
                          </div>
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              </Box>
            ))
          )}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="street-trees">
        <Stack gap="xs">
          {isLoadingStreetTrees ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : sortedStreetTrees.length === 0 ? (
            <Text c="dimmed" ta="center" py="lg">
              周辺に街路樹がありません
            </Text>
          ) : (
            sortedStreetTrees.map((feature) => {
              const tree = feature.properties as StreetTreeAsset;
              const displayName = tree.displayName || tree.speciesName || tree.ledgerId || '街路樹';
              const treeEmoji = TREE_EMOJI[tree.category] || '\u{1F333}';

              return (
                <Card
                  key={tree.id}
                  padding="xs"
                  radius="sm"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                    borderColor: selectedAssetId === tree.id ? 'var(--mantine-color-green-5)' : undefined,
                    backgroundColor: selectedAssetId === tree.id ? 'var(--mantine-color-green-0)' : undefined,
                  }}
                  className="asset-card-hover"
                  onClick={() => {
                    selectAsset(tree.id, 'street-tree', feature.geometry);
                    if (feature.geometry) setFlyToGeometry(feature.geometry, true);
                  }}
                >
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Text size="md" style={{ flexShrink: 0, lineHeight: 1 }}>
                      {treeEmoji}
                    </Text>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text fw={500} size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                          {displayName}
                        </Text>
                        <Badge color={TREE_CATEGORY_COLORS[tree.category] || 'gray'} size="xs" style={{ flexShrink: 0 }}>
                          {TREE_CATEGORY_LABELS[tree.category] || tree.category}
                        </Badge>
                      </Group>


                      {tree.height && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {tree.height}m{tree.trunkDiameter ? ` · ${tree.trunkDiameter}cm` : ''}
                        </Text>
                      )}
                    </div>
                  </Group>
                </Card>
              );
            })
          )}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="pavement-sections">
        <Stack gap="xs">
          {isLoadingPavementSections ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : sortedPavementSections.length === 0 ? (
            <Text c="dimmed" ta="center" py="lg">
              周辺に道路舗装がありません
            </Text>
          ) : (
            sortedPavementSections.map((feature) => {
              const ps = feature.properties as PavementSectionAsset;
              const displayName = ps.name || ps.sectionId || ps.routeNumber || '舗装区間';

              return (
                <Card
                  key={ps.id}
                  padding="xs"
                  radius="sm"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                    borderColor: selectedAssetId === ps.id ? 'var(--mantine-color-orange-5)' : undefined,
                    backgroundColor: selectedAssetId === ps.id ? 'var(--mantine-color-orange-0)' : undefined,
                  }}
                  className="asset-card-hover"
                  onClick={() => {
                    selectAsset(ps.id, 'pavement-section', feature.geometry);
                    if (feature.geometry) setFlyToGeometry(feature.geometry, true);
                  }}
                >
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Text size="md" style={{ flexShrink: 0, lineHeight: 1 }}>
                      {'\u{1F6E3}\uFE0F'}
                    </Text>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text fw={500} size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                          {displayName}
                        </Text>
                        <Badge color={PAVEMENT_TYPE_COLORS[ps.pavementType] || 'gray'} size="xs" style={{ flexShrink: 0 }}>
                          {ps.pavementType}
                        </Badge>
                      </Group>

                      <Group gap={4} mt={2}>
                        {ps.mci != null && (
                          <Badge
                            variant="outline"
                            size="xs"
                            color={ps.mci >= 7 ? 'green' : ps.mci >= 4 ? 'yellow' : 'red'}
                          >
                            MCI {ps.mci.toFixed(1)}
                          </Badge>
                        )}
                        {ps.priorityRank != null && (
                          <Badge variant="outline" size="xs" color="orange">
                            #{ps.priorityRank}
                          </Badge>
                        )}
                      </Group>

                      {(ps.length || ps.width) && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {ps.length ? `${ps.length}m` : ''}{ps.length && ps.width ? ' × ' : ''}{ps.width ? `${ps.width}m` : ''}
                        </Text>
                      )}
                    </div>
                  </Group>
                </Card>
              );
            })
          )}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="pump-stations">
        <Stack gap="xs">
          {isLoadingPumpStations ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : sortedPumpStations.length === 0 ? (
            <Text c="dimmed" ta="center" py="lg">
              周辺にポンプ施設がありません
            </Text>
          ) : (
            sortedPumpStations.map((feature) => {
              const pump = feature.properties as PumpStationAsset;
              const displayName = pump.name || pump.stationId || 'ポンプ施設';
              const pumpEmoji = PUMP_EMOJI[pump.category] || '\u{1F4A7}';

              return (
                <Card
                  key={pump.id}
                  padding="xs"
                  radius="sm"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                    borderColor: selectedAssetId === pump.id ? 'var(--mantine-color-blue-5)' : undefined,
                    backgroundColor: selectedAssetId === pump.id ? 'var(--mantine-color-blue-0)' : undefined,
                  }}
                  className="asset-card-hover"
                  onClick={() => {
                    selectAsset(pump.id, 'pump-station', feature.geometry);
                    if (feature.geometry) setFlyToGeometry(feature.geometry, true);
                  }}
                >
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Text size="md" style={{ flexShrink: 0, lineHeight: 1 }}>
                      {pumpEmoji}
                    </Text>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text fw={500} size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                          {displayName}
                        </Text>
                        <Badge color={PUMP_CATEGORY_COLORS[pump.category] || 'gray'} size="xs" style={{ flexShrink: 0 }}>
                          {PUMP_CATEGORY_LABELS[pump.category] || pump.category}
                        </Badge>
                      </Group>


                      {pump.designCapacity && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {pump.designCapacity} m³/min{pump.pumpCount ? ` · ${pump.pumpCount}台` : ''}
                        </Text>
                      )}
                    </div>
                  </Group>
                </Card>
              );
            })
          )}
        </Stack>
      </Tabs.Panel>
    </Tabs>
  );
}
