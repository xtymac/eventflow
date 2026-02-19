import { useState, useEffect, useRef } from 'react';
import {
  Stack,
  Group,
  Text,
  Loader,
  Center,
} from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { IconSearch, IconPlus, IconFilter, IconChevronDown, IconChevronRight, IconX, IconArchive } from '@tabler/icons-react';
import { useEvents } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { ConstructionEvent, EventStatus } from '@nagoya/shared';
import dayjs from 'dayjs';
import { formatLocalDate } from '../../utils/dateFormat';

const STATUS_VARIANT: Record<EventStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  planned: 'default',
  active: 'secondary',
  pending_review: 'secondary',
  closed: 'outline',
  archived: 'outline',
  cancelled: 'destructive',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  pending_review: 'Pending Review',
  closed: 'Closed',
  archived: 'Archived',
  cancelled: 'Cancelled',
};

export function EventList() {
  // Persisted filter state from store (including filtersOpen)
  const { selectedEventId, selectEvent, openEventDetailModal, openEventForm, eventFilters, setEventFilter, resetEventFilters, filtersOpen, toggleFilters, setFlyToGeometry, setHoveredEvent, isEventFormOpen } = useUIStore();

  // Cleanup hover state on unmount to prevent stale hover
  useEffect(() => {
    return () => {
      setHoveredEvent(null);
    };
  }, [setHoveredEvent]);
  const { status: statusFilter, search, department, dateRange, showArchivedSection } = eventFilters;

  // Track close-up state for toggling zoom levels
  const [isCloseUp, setIsCloseUp] = useState(false);

  // Refs for scrolling to selected event
  const eventCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to selected event when it changes (e.g., from map click)
  useEffect(() => {
    if (selectedEventId) {
      const cardElement = eventCardRefs.current.get(selectedEventId);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedEventId]);

  // Main events query (excludes archived)
  const { data, isLoading, error } = useEvents({
    name: search || undefined,
    status: statusFilter as EventStatus | undefined,
    department: department || undefined,
    startDateFrom: formatLocalDate(dateRange.from),
    startDateTo: formatLocalDate(dateRange.to),
  });

  // Archived events query (only when section is expanded)
  const { data: archivedData, isLoading: archivedLoading } = useEvents(
    {
      name: search || undefined,
      status: statusFilter as EventStatus | undefined,
      department: department || undefined,
      startDateFrom: formatLocalDate(dateRange.from),
      startDateTo: formatLocalDate(dateRange.to),
      includeArchived: true,
    },
    { enabled: showArchivedSection }
  );

  // Compute active filter count for badge display (search is separate, not counted)
  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (department ? 1 : 0) +
    (dateRange.from || dateRange.to ? 1 : 0);

  const allEvents = data?.data || [];
  const archivedCount = data?.meta?.archivedCount ?? 0;

  // Hide archived events from main list (cancelled events are shown)
  const events = allEvents.filter(e => !e.archivedAt);

  // Filter archived events from the includeArchived query
  const archivedEvents = (archivedData?.data || []).filter(e => e.archivedAt);

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600}>Events ({events.length})</Text>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="default" size="icon" onClick={() => openEventForm()}>
              <IconPlus size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create new event</TooltipContent>
        </Tooltip>
      </Group>

      <div className="relative">
        <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={search}
          onChange={(e) => setEventFilter('search', e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      <button
        onClick={toggleFilters}
        aria-expanded={filtersOpen}
        aria-controls="event-filters"
        className="w-full text-left"
      >
        <Group justify="space-between">
          <Group gap="xs">
            <IconFilter size={14} />
            <Text size="sm" fw={500}>Filters</Text>
            {activeFilterCount > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">{activeFilterCount}</Badge>
            )}
          </Group>
          <IconChevronDown
            size={14}
            style={{
              transform: filtersOpen ? 'rotate(180deg)' : undefined,
              transition: 'transform 200ms',
            }}
          />
        </Group>
      </button>

      <Collapsible open={filtersOpen}>
        <CollapsibleContent id="event-filters">
          <Stack gap="sm">
            <div>
              <Text size="xs" c="dimmed" fw={600} mb="xs">Status</Text>
              <Group gap="xs" className="flex-wrap">
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={statusFilter === 'planned'}
                  onPressedChange={(pressed) => setEventFilter('status', pressed ? 'planned' : null)}
                >
                  Planned
                </Toggle>
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={statusFilter === 'active'}
                  onPressedChange={(pressed) => setEventFilter('status', pressed ? 'active' : null)}
                >
                  Active
                </Toggle>
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={statusFilter === 'pending_review'}
                  onPressedChange={(pressed) => setEventFilter('status', pressed ? 'pending_review' : null)}
                >
                  Pending Review
                </Toggle>
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={statusFilter === 'closed'}
                  onPressedChange={(pressed) => setEventFilter('status', pressed ? 'closed' : null)}
                >
                  Closed
                </Toggle>
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={statusFilter === 'cancelled'}
                  onPressedChange={(pressed) => setEventFilter('status', pressed ? 'cancelled' : null)}
                >
                  Cancelled
                </Toggle>
              </Group>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Department</label>
              <Input
                placeholder="Filter by department..."
                className="h-8 text-xs"
                value={department || ''}
                onChange={(e) => setEventFilter('department', e.target.value || null)}
              />
            </div>

            <div>
              <Text size="xs" c="dimmed" fw={600} mb="xs">Start Date Range</Text>
              <Group grow>
                <DatePickerInput
                  placeholder="From"
                  value={dateRange.from}
                  onChange={(date) => setEventFilter('dateRange', { ...dateRange, from: date })}
                  clearable
                />
                <DatePickerInput
                  placeholder="To"
                  value={dateRange.to}
                  onChange={(date) => setEventFilter('dateRange', { ...dateRange, to: date })}
                  clearable
                />
              </Group>
            </div>

            {activeFilterCount > 0 && (
              <Group justify="flex-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetEventFilters}
                >
                  <IconX size={14} />
                  Clear all filters
                </Button>
              </Group>
            )}
          </Stack>
        </CollapsibleContent>
      </Collapsible>

      <Stack gap="xs">
        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : error ? (
          <Center py="xl">
            <Text c="red" size="sm">Failed to load events</Text>
          </Center>
        ) : events.length === 0 ? (
          <Text c="dimmed" ta="center" className="py-6">
            No events found
          </Text>
        ) : (
          events.map((event: ConstructionEvent) => (
            <div
              key={event.id}
              ref={(el) => {
                if (el) eventCardRefs.current.set(event.id, el);
              }}
              className={`rounded-md border p-3 cursor-pointer transition-colors duration-150 hover:shadow-sm ${
                selectedEventId === event.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => {
                if (selectedEventId === event.id) {
                  // Already selected: toggle between overview and close-up
                  if (event.geometry) {
                    const newCloseUp = !isCloseUp;
                    setIsCloseUp(newCloseUp);
                    setFlyToGeometry(event.geometry, newCloseUp);
                  }
                } else {
                  // First click: select, open detail panel, and fly to event
                  selectEvent(event.id);
                  openEventDetailModal(event.id);
                  setIsCloseUp(false);
                  if (event.geometry) {
                    setFlyToGeometry(event.geometry, false);
                  }
                }
              }}
              onMouseEnter={() => !isEventFormOpen && setHoveredEvent(event.id)}
              onMouseLeave={() => setHoveredEvent(null)}
            >
              <Group justify="space-between" mb="xs" className="flex-nowrap items-start">
                <Text fw={500} size="sm" lineClamp={2} className="flex-1" style={{ lineHeight: 1.3 }}>
                  {event.name}
                </Text>
                <Badge variant={STATUS_VARIANT[event.status]} className="shrink-0 mt-0.5">
                  {STATUS_LABELS[event.status]}
                </Badge>
              </Group>

              {event.department && (
                <Text size="xs" c="dimmed" fw={500} mb="xs">
                  {event.department}
                </Text>
              )}

              <Group gap="xs" mb="xs">
                <Badge variant="outline" className="text-[10px]">
                  {event.restrictionType}
                </Badge>
                {event.ward && (
                  <Badge variant="outline" className="text-[10px]">
                    {event.ward}
                  </Badge>
                )}
              </Group>

              <Text size="xs" c="dimmed">
                {dayjs(event.startDate).format('YYYY/MM/DD')} - {dayjs(event.endDate).format('YYYY/MM/DD')}
              </Text>
            </div>
          ))
        )}
      </Stack>

      {/* Archived Events Section */}
      {archivedCount > 0 && (
        <Stack gap="xs" mt="md">
          <button
            onClick={() => setEventFilter('showArchivedSection', !showArchivedSection)}
            aria-expanded={showArchivedSection}
            aria-controls="archived-events"
            className="w-full text-left"
          >
            <Group
              justify="space-between"
              px="xs"
              className="py-1.5 bg-muted rounded"
            >
              <Group gap="xs">
                <IconArchive size={14} className="text-muted-foreground" />
                <Text size="sm" fw={500} c="dimmed">
                  Archived Events ({archivedCount})
                </Text>
              </Group>
              {showArchivedSection ? (
                <IconChevronDown size={14} className="text-muted-foreground" />
              ) : (
                <IconChevronRight size={14} className="text-muted-foreground" />
              )}
            </Group>
          </button>

          <Collapsible open={showArchivedSection}>
            <CollapsibleContent id="archived-events">
              <Stack gap="xs">
                {archivedLoading ? (
                  <Center py="md">
                    <Loader size="sm" />
                  </Center>
                ) : archivedEvents.length === 0 ? (
                  <Text c="dimmed" ta="center" size="sm" className="py-2">
                    No archived events
                  </Text>
                ) : (
                  archivedEvents.map((event: ConstructionEvent) => (
                    <div
                      key={event.id}
                      ref={(el) => {
                        if (el) eventCardRefs.current.set(event.id, el);
                      }}
                      className={`rounded-md border p-3 cursor-pointer transition-colors duration-150 opacity-85 ${
                        selectedEventId === event.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-muted bg-muted/30 hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        if (selectedEventId === event.id) {
                          if (event.geometry) {
                            const newCloseUp = !isCloseUp;
                            setIsCloseUp(newCloseUp);
                            setFlyToGeometry(event.geometry, newCloseUp);
                          }
                        } else {
                          selectEvent(event.id);
                          openEventDetailModal(event.id);
                          setIsCloseUp(false);
                          if (event.geometry) {
                            setFlyToGeometry(event.geometry, false);
                          }
                        }
                      }}
                      onMouseEnter={() => !isEventFormOpen && setHoveredEvent(event.id)}
                      onMouseLeave={() => setHoveredEvent(null)}
                    >
                      <Group justify="space-between" mb="xs" className="flex-nowrap items-start">
                        <Text fw={500} size="sm" lineClamp={2} c="dimmed" className="flex-1" style={{ lineHeight: 1.3 }}>
                          {event.name}
                        </Text>
                        <Group gap={4}>
                          <Badge variant="outline" className="text-[10px]">
                            Archived
                          </Badge>
                          <Badge variant={STATUS_VARIANT[event.status]} className="shrink-0">
                            {STATUS_LABELS[event.status]}
                          </Badge>
                        </Group>
                      </Group>

                      {event.department && (
                        <Text size="xs" c="dimmed" fw={500} mb="xs">
                          {event.department}
                        </Text>
                      )}

                      <Group gap="xs" mb="xs">
                        <Badge variant="outline" className="text-[10px]">
                          {event.restrictionType}
                        </Badge>
                        {event.ward && (
                          <Badge variant="outline" className="text-[10px]">
                            {event.ward}
                          </Badge>
                        )}
                      </Group>

                      <Text size="xs" c="dimmed">
                        {dayjs(event.startDate).format('YYYY/MM/DD')} - {dayjs(event.endDate).format('YYYY/MM/DD')}
                      </Text>
                    </div>
                  ))
                )}
              </Stack>
            </CollapsibleContent>
          </Collapsible>
        </Stack>
      )}
    </Stack>
  );
}
