import { useState, useEffect, useRef, useMemo } from 'react';
import { Stack, Group, Text, Center, Box, Loader } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IconChevronLeft, IconChevronRight, IconTree, IconLeaf, IconRuler2, IconDroplet } from '@tabler/icons-react';
import * as turf from '@turf/turf';
import { useStreetTreesInBbox, useParkFacilitiesInBbox, usePavementSectionsInBbox, usePumpStationsInBbox, useGreenSpacesInBbox } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { StreetTreeAsset, ParkFacilityAsset, PavementSectionAsset, PumpStationAsset, GreenSpaceAsset } from '@nagoya/shared';
import type { Feature } from 'geojson';

const TREE_CATEGORY_COLORS: Record<string, string> = {
  deciduous: 'bg-green-100 text-green-800',
  evergreen: 'bg-teal-100 text-teal-800',
  conifer: 'bg-lime-100 text-lime-800',
  palmLike: 'bg-orange-100 text-orange-800',
  shrub: 'bg-yellow-100 text-yellow-800',
};

const TREE_CATEGORY_LABELS: Record<string, string> = {
  deciduous: '\u843D\u8449\u6A39',
  evergreen: '\u5E38\u7DD1\u6A39',
  conifer: '\u91DD\u8449\u6A39',
  palmLike: '\u30E4\u30B7\u985E',
  shrub: '\u4F4E\u6728',
};

const PARK_FACILITY_COLORS: Record<string, string> = {
  toilet: 'bg-blue-100 text-blue-800',
  playground: 'bg-orange-100 text-orange-800',
  bench: 'bg-gray-100 text-gray-800',
  shelter: 'bg-teal-100 text-teal-800',
  fence: 'bg-gray-200 text-gray-800',
  gate: 'bg-gray-200 text-gray-800',
  drainage: 'bg-cyan-100 text-cyan-800',
  lighting: 'bg-yellow-100 text-yellow-800',
  waterFountain: 'bg-blue-100 text-blue-800',
  signBoard: 'bg-indigo-100 text-indigo-800',
  pavement: 'bg-gray-100 text-gray-800',
  sportsFacility: 'bg-lime-100 text-lime-800',
  building: 'bg-violet-100 text-violet-800',
  other: 'bg-gray-100 text-gray-800',
};

const PAVEMENT_TYPE_COLORS: Record<string, string> = {
  asphalt: 'bg-gray-200 text-gray-800',
  concrete: 'bg-gray-100 text-gray-800',
  interlocking: 'bg-orange-100 text-orange-800',
  gravel: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800',
};

const PUMP_CATEGORY_COLORS: Record<string, string> = {
  stormwater: 'bg-blue-100 text-blue-800',
  sewage: 'bg-violet-100 text-violet-800',
  irrigation: 'bg-green-100 text-green-800',
  combined: 'bg-cyan-100 text-cyan-800',
};

const PUMP_CATEGORY_LABELS: Record<string, string> = {
  stormwater: '\u96E8\u6C34',
  sewage: '\u6C5A\u6C34',
  irrigation: '\u704C\u6F51',
  combined: '\u5408\u6D41',
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
        const parkName = gs?.asset.displayName || gs?.asset.nameJa || gs?.asset.name || '\u516C\u5712';
        groups.set(ref, { parkName, feature: gs?.feature ?? null, facilities: [] });
      }
      groups.get(ref)!.facilities.push(f);
    }
    return Array.from(groups.entries()).map(([id, g]) => ({ parkId: id, ...g }));
  }, [sortedParkFacilities, greenSpaceMap]);

  // Strip park name prefix from facility name for cleaner display
  const stripParkPrefix = (facilityName: string, parkName: string): string => {
    // Try removing "ParkName " or "ParkName\u3000" prefix
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
      <Group gap={4} mb="md" className="flex-nowrap">
        {canScrollLeft && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleScrollLeft}
            aria-label="Scroll tabs left"
          >
            <IconChevronLeft size={16} />
          </Button>
        )}
        <div
          ref={tabsScrollRef}
          className="tabs-scroll-container flex-1 overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: 'none' }}
          onScroll={updateScrollState}
        >
          <TabsList className="flex-nowrap min-w-max">
            <TabsTrigger
              value="park-facilities"
              ref={(el) => { tabRefs.current['park-facilities'] = el; }}
              onClick={() => handleTabClick('park-facilities')}
            >
              <IconTree size={14} />
              公園 ({sortedParkFacilities.length})
            </TabsTrigger>
            <TabsTrigger
              value="street-trees"
              ref={(el) => { tabRefs.current['street-trees'] = el; }}
              onClick={() => handleTabClick('street-trees')}
            >
              <IconLeaf size={14} />
              街路樹 ({sortedStreetTrees.length})
            </TabsTrigger>
            <TabsTrigger
              value="pavement-sections"
              ref={(el) => { tabRefs.current['pavement-sections'] = el; }}
              onClick={() => handleTabClick('pavement-sections')}
            >
              <IconRuler2 size={14} />
              道路舗装 ({sortedPavementSections.length})
            </TabsTrigger>
            <TabsTrigger
              value="pump-stations"
              ref={(el) => { tabRefs.current['pump-stations'] = el; }}
              onClick={() => handleTabClick('pump-stations')}
            >
              <IconDroplet size={14} />
              ポンプ施設 ({sortedPumpStations.length})
            </TabsTrigger>
          </TabsList>
        </div>
        {canScrollRight && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleScrollRight}
            aria-label="Scroll tabs right"
          >
            <IconChevronRight size={16} />
          </Button>
        )}
      </Group>

      <TabsContent value="park-facilities">
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
                <div
                  className="flex items-center gap-1.5 mb-1.5 mt-1.5 px-1.5 py-1 rounded-sm cursor-pointer"
                  style={{
                    cursor: group.feature ? 'pointer' : 'default',
                    backgroundColor: selectedAssetId === group.parkId ? 'hsl(var(--accent))' : undefined,
                    border: selectedAssetId === group.parkId ? '1px solid hsl(var(--ring))' : '1px solid transparent',
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
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                    {group.facilities.length}
                  </Badge>
                </div>

                {/* Facility cards under this park */}
                <Stack gap={4} className="ml-4">
                  {group.facilities.map((feature) => {
                    const pf = feature.properties as ParkFacilityAsset;
                    const rawName = pf.name || pf.facilityId || '\u65BD\u8A2D';
                    const shortName = stripParkPrefix(rawName, group.parkName);
                    const emoji = FACILITY_EMOJI[pf.category] || '\u{1F4E6}';

                    return (
                      <div
                        key={pf.id}
                        className="border rounded-sm p-1.5 cursor-pointer transition-colors asset-card-hover hover:bg-accent"
                        style={{
                          borderColor: selectedAssetId === pf.id ? 'hsl(270 50% 60%)' : undefined,
                          backgroundColor: selectedAssetId === pf.id ? 'hsl(270 50% 95%)' : undefined,
                        }}
                        onClick={() => {
                          selectAsset(pf.id, 'park-facility', feature.geometry);
                          if (feature.geometry) setFlyToGeometry(feature.geometry, true);
                        }}
                      >
                        <Group gap="xs" className="flex-nowrap">
                          <Text size="md" className="shrink-0 leading-none">
                            {emoji}
                          </Text>
                          <div className="flex-1 min-w-0">
                            <Text fw={500} size="sm" lineClamp={1}>
                              {shortName}
                            </Text>
                            <Badge variant="secondary" className={`text-xs mt-0.5 ${PARK_FACILITY_COLORS[pf.category] || 'bg-gray-100 text-gray-800'}`}>
                              {pf.category}
                            </Badge>
                          </div>
                        </Group>
                      </div>
                    );
                  })}
                </Stack>
              </Box>
            ))
          )}
        </Stack>
      </TabsContent>

      <TabsContent value="street-trees">
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
              const displayName = tree.displayName || tree.speciesName || tree.ledgerId || '\u8857\u8DEF\u6A39';
              const treeEmoji = TREE_EMOJI[tree.category] || '\u{1F333}';

              return (
                <div
                  key={tree.id}
                  className="border rounded-sm p-1.5 cursor-pointer transition-colors asset-card-hover hover:bg-accent"
                  style={{
                    borderColor: selectedAssetId === tree.id ? 'hsl(142 70% 45%)' : undefined,
                    backgroundColor: selectedAssetId === tree.id ? 'hsl(142 70% 95%)' : undefined,
                  }}
                  onClick={() => {
                    selectAsset(tree.id, 'street-tree', feature.geometry);
                    if (feature.geometry) setFlyToGeometry(feature.geometry, true);
                  }}
                >
                  <Group gap="xs" className="flex-nowrap">
                    <Text size="md" className="shrink-0 leading-none">
                      {treeEmoji}
                    </Text>
                    <div className="flex-1 min-w-0">
                      <Group justify="space-between" className="flex-nowrap" gap="xs">
                        <Text fw={500} size="sm" lineClamp={1} className="flex-1 min-w-0">
                          {displayName}
                        </Text>
                        <Badge variant="secondary" className={`text-xs shrink-0 ${TREE_CATEGORY_COLORS[tree.category] || 'bg-gray-100 text-gray-800'}`}>
                          {TREE_CATEGORY_LABELS[tree.category] || tree.category}
                        </Badge>
                      </Group>

                      {tree.height && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {tree.height}m{tree.trunkDiameter ? ` \u00B7 ${tree.trunkDiameter}cm` : ''}
                        </Text>
                      )}
                    </div>
                  </Group>
                </div>
              );
            })
          )}
        </Stack>
      </TabsContent>

      <TabsContent value="pavement-sections">
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
              const displayName = ps.name || ps.sectionId || ps.routeNumber || '\u8217\u88C5\u533A\u9593';

              return (
                <div
                  key={ps.id}
                  className="border rounded-sm p-1.5 cursor-pointer transition-colors asset-card-hover hover:bg-accent"
                  style={{
                    borderColor: selectedAssetId === ps.id ? 'hsl(25 95% 53%)' : undefined,
                    backgroundColor: selectedAssetId === ps.id ? 'hsl(25 95% 95%)' : undefined,
                  }}
                  onClick={() => {
                    selectAsset(ps.id, 'pavement-section', feature.geometry);
                    if (feature.geometry) setFlyToGeometry(feature.geometry, true);
                  }}
                >
                  <Group gap="xs" className="flex-nowrap">
                    <Text size="md" className="shrink-0 leading-none">
                      {'\u{1F6E3}\uFE0F'}
                    </Text>
                    <div className="flex-1 min-w-0">
                      <Group justify="space-between" className="flex-nowrap" gap="xs">
                        <Text fw={500} size="sm" lineClamp={1} className="flex-1 min-w-0">
                          {displayName}
                        </Text>
                        <Badge variant="secondary" className={`text-xs shrink-0 ${PAVEMENT_TYPE_COLORS[ps.pavementType] || 'bg-gray-100 text-gray-800'}`}>
                          {ps.pavementType}
                        </Badge>
                      </Group>

                      <div className="flex items-center gap-1 mt-0.5">
                        {ps.mci != null && (
                          <Badge variant="outline" className={`text-xs ${ps.mci >= 7 ? 'border-green-500 text-green-700' : ps.mci >= 4 ? 'border-yellow-500 text-yellow-700' : 'border-red-500 text-red-700'}`}>
                            MCI {ps.mci.toFixed(1)}
                          </Badge>
                        )}
                        {ps.priorityRank != null && (
                          <Badge variant="outline" className="text-xs border-orange-500 text-orange-700">
                            #{ps.priorityRank}
                          </Badge>
                        )}
                      </div>

                      {(ps.length || ps.width) && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {ps.length ? `${ps.length}m` : ''}{ps.length && ps.width ? ' \u00D7 ' : ''}{ps.width ? `${ps.width}m` : ''}
                        </Text>
                      )}
                    </div>
                  </Group>
                </div>
              );
            })
          )}
        </Stack>
      </TabsContent>

      <TabsContent value="pump-stations">
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
              const displayName = pump.name || pump.stationId || '\u30DD\u30F3\u30D7\u65BD\u8A2D';
              const pumpEmoji = PUMP_EMOJI[pump.category] || '\u{1F4A7}';

              return (
                <div
                  key={pump.id}
                  className="border rounded-sm p-1.5 cursor-pointer transition-colors asset-card-hover hover:bg-accent"
                  style={{
                    borderColor: selectedAssetId === pump.id ? 'hsl(217 91% 60%)' : undefined,
                    backgroundColor: selectedAssetId === pump.id ? 'hsl(217 91% 95%)' : undefined,
                  }}
                  onClick={() => {
                    selectAsset(pump.id, 'pump-station', feature.geometry);
                    if (feature.geometry) setFlyToGeometry(feature.geometry, true);
                  }}
                >
                  <Group gap="xs" className="flex-nowrap">
                    <Text size="md" className="shrink-0 leading-none">
                      {pumpEmoji}
                    </Text>
                    <div className="flex-1 min-w-0">
                      <Group justify="space-between" className="flex-nowrap" gap="xs">
                        <Text fw={500} size="sm" lineClamp={1} className="flex-1 min-w-0">
                          {displayName}
                        </Text>
                        <Badge variant="secondary" className={`text-xs shrink-0 ${PUMP_CATEGORY_COLORS[pump.category] || 'bg-blue-100 text-blue-800'}`}>
                          {PUMP_CATEGORY_LABELS[pump.category] || pump.category}
                        </Badge>
                      </Group>

                      {pump.designCapacity && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {pump.designCapacity} m³/min{pump.pumpCount ? ` \u00B7 ${pump.pumpCount}\u53F0` : ''}
                        </Text>
                      )}
                    </div>
                  </Group>
                </div>
              );
            })
          )}
        </Stack>
      </TabsContent>
    </Tabs>
  );
}
