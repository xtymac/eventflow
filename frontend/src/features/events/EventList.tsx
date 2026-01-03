import { useState, useEffect, useRef } from 'react';
import {
  Stack,
  TextInput,
  Card,
  Text,
  Badge,
  Group,
  Loader,
  Center,
  ActionIcon,
  Tooltip,
  Chip,
  Button,
  Collapse,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconSearch, IconPlus, IconFilter, IconChevronDown, IconChevronRight, IconX, IconArchive } from '@tabler/icons-react';
import { useEvents } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { ConstructionEvent, EventStatus } from '@nagoya/shared';
import dayjs from 'dayjs';
import { formatLocalDate } from '../../utils/dateFormat';

const STATUS_COLORS: Record<EventStatus, string> = {
  planned: 'blue',
  active: 'yellow',
  ended: 'gray',
  cancelled: 'red',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

export function EventList() {
  // Persisted filter state from store (including filtersOpen)
  const { selectedEventId, selectEvent, openEventForm, eventFilters, setEventFilter, resetEventFilters, filtersOpen, toggleFilters, setFlyToGeometry } = useUIStore();
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

  // Hide cancelled and archived events from main list
  const events = allEvents.filter(e =>
    (statusFilter === 'cancelled' || e.status !== 'cancelled') && !e.archivedAt
  );

  // Filter archived events from the includeArchived query
  const archivedEvents = (archivedData?.data || []).filter(e =>
    e.archivedAt && (statusFilter === 'cancelled' || e.status !== 'cancelled')
  );

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600}>Events ({events.length})</Text>
        <Tooltip label="Create new event">
          <ActionIcon variant="filled" onClick={() => openEventForm()}>
            <IconPlus size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <TextInput
        placeholder="Search events..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setEventFilter('search', e.target.value)}
        size="sm"
      />

      <UnstyledButton
        onClick={toggleFilters}
        aria-expanded={filtersOpen}
        aria-controls="event-filters"
        style={{ width: '100%', textAlign: 'left' }}
      >
        <Group justify="space-between">
          <Group gap="xs">
            <IconFilter size={14} />
            <Text size="sm" fw={500}>Filters</Text>
            {activeFilterCount > 0 && (
              <Badge size="xs" radius="xl">{activeFilterCount}</Badge>
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
      </UnstyledButton>

      <Collapse in={filtersOpen} id="event-filters">
        <Stack gap="sm">
          <div>
            <Text size="xs" c="dimmed" fw={600} mb={4}>Status</Text>
            <Chip.Group
              multiple
              value={statusFilter ? [statusFilter] : []}
              onChange={(val) => {
                if (val.length === 0) {
                  setEventFilter('status', null);
                } else {
                  const newValue = val.find((v) => v !== statusFilter);
                  setEventFilter('status', newValue || val[0]);
                }
              }}
            >
              <Group gap="xs">
                <Chip value="planned">Planned</Chip>
                <Chip value="active">Active</Chip>
                <Chip value="ended">Ended</Chip>
                <Chip value="cancelled" color="red">Cancelled</Chip>
              </Group>
            </Chip.Group>
          </div>

          <TextInput
            label="Department"
            placeholder="Filter by department..."
            size="xs"
            value={department || ''}
            onChange={(e) => setEventFilter('department', e.target.value || null)}
          />

          <div>
            <Text size="xs" c="dimmed" fw={600} mb={4}>Start Date Range</Text>
            <Group grow>
              <DatePickerInput
                size="xs"
                placeholder="From"
                value={dateRange.from}
                onChange={(date) => setEventFilter('dateRange', { ...dateRange, from: date })}
                clearable
              />
              <DatePickerInput
                size="xs"
                placeholder="To"
                value={dateRange.to}
                onChange={(date) => setEventFilter('dateRange', { ...dateRange, to: date })}
                minDate={dateRange.from || undefined}
                clearable
              />
            </Group>
          </div>

          {activeFilterCount > 0 && (
            <Group justify="flex-end">
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconX size={14} />}
                onClick={resetEventFilters}
              >
                Clear all filters
              </Button>
            </Group>
          )}
        </Stack>
      </Collapse>

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
          <Text c="dimmed" ta="center" py="lg">
            No events found
          </Text>
        ) : (
          events.map((event: ConstructionEvent) => (
            <Card
              key={event.id}
              ref={(el) => {
                if (el) eventCardRefs.current.set(event.id, el);
              }}
              padding="sm"
              radius="sm"
              withBorder
              style={{
                cursor: 'pointer',
                borderColor: selectedEventId === event.id ? 'var(--mantine-color-blue-5)' : undefined,
                backgroundColor: selectedEventId === event.id ? 'var(--mantine-color-blue-0)' : undefined,
              }}
              onClick={() => {
                if (selectedEventId === event.id) {
                  // Already selected: toggle between overview and close-up
                  if (event.geometry) {
                    const newCloseUp = !isCloseUp;
                    setIsCloseUp(newCloseUp);
                    setFlyToGeometry(event.geometry, newCloseUp);
                  }
                } else {
                  // First click: select, reset to overview, and fly to event
                  selectEvent(event.id);
                  setIsCloseUp(false);
                  if (event.geometry) {
                    setFlyToGeometry(event.geometry, false);
                  }
                }
              }}
            >
              <Group justify="space-between" mb={4} wrap="nowrap" align="flex-start">
                <Text fw={500} size="sm" lineClamp={2} style={{ flex: 1, lineHeight: 1.3 }}>
                  {event.name}
                </Text>
                <Badge color={STATUS_COLORS[event.status]} size="sm" style={{ flexShrink: 0, marginTop: 2 }}>
                  {STATUS_LABELS[event.status]}
                </Badge>
              </Group>

              {event.department && (
                <Text size="xs" c="gray.6" fw={500} mb={6}>
                  {event.department}
                </Text>
              )}

              <Group gap="xs" mb={6}>
                <Badge variant="outline" size="xs">
                  {event.restrictionType}
                </Badge>
                {event.ward && (
                  <Badge variant="outline" size="xs" color="gray">
                    {event.ward}
                  </Badge>
                )}
              </Group>

              <Text size="xs" c="dimmed">
                {dayjs(event.startDate).format('YYYY/MM/DD')} - {dayjs(event.endDate).format('YYYY/MM/DD')}
              </Text>
            </Card>
          ))
        )}
      </Stack>

      {/* Archived Events Section */}
      {archivedCount > 0 && (
        <Stack gap="xs" mt="md">
          <UnstyledButton
            onClick={() => setEventFilter('showArchivedSection', !showArchivedSection)}
            aria-expanded={showArchivedSection}
            aria-controls="archived-events"
            style={{ width: '100%', textAlign: 'left' }}
          >
            <Group
              justify="space-between"
              p="xs"
              style={{
                backgroundColor: 'var(--mantine-color-gray-1)',
                borderRadius: 'var(--mantine-radius-sm)',
              }}
            >
              <Group gap="xs">
                <IconArchive size={14} color="var(--mantine-color-gray-6)" />
                <Text size="sm" fw={500} c="dimmed">
                  Archived Events ({archivedCount})
                </Text>
              </Group>
              {showArchivedSection ? (
                <IconChevronDown size={14} color="var(--mantine-color-gray-6)" />
              ) : (
                <IconChevronRight size={14} color="var(--mantine-color-gray-6)" />
              )}
            </Group>
          </UnstyledButton>

          <Collapse in={showArchivedSection} id="archived-events">
            <Stack gap="xs">
              {archivedLoading ? (
                <Center py="md">
                  <Loader size="sm" />
                </Center>
              ) : archivedEvents.length === 0 ? (
                <Text c="dimmed" ta="center" py="sm" size="sm">
                  No archived events
                </Text>
              ) : (
                archivedEvents.map((event: ConstructionEvent) => (
                  <Card
                    key={event.id}
                    ref={(el) => {
                      if (el) eventCardRefs.current.set(event.id, el);
                    }}
                    padding="sm"
                    radius="sm"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      borderColor: selectedEventId === event.id ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-3)',
                      backgroundColor: selectedEventId === event.id ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-gray-0)',
                      opacity: 0.85,
                    }}
                    onClick={() => {
                      if (selectedEventId === event.id) {
                        if (event.geometry) {
                          const newCloseUp = !isCloseUp;
                          setIsCloseUp(newCloseUp);
                          setFlyToGeometry(event.geometry, newCloseUp);
                        }
                      } else {
                        selectEvent(event.id);
                        setIsCloseUp(false);
                        if (event.geometry) {
                          setFlyToGeometry(event.geometry, false);
                        }
                      }
                    }}
                  >
                    <Group justify="space-between" mb={4} wrap="nowrap" align="flex-start">
                      <Text fw={500} size="sm" lineClamp={2} style={{ flex: 1, lineHeight: 1.3 }} c="dimmed">
                        {event.name}
                      </Text>
                      <Group gap={4}>
                        <Badge color="gray" size="xs" variant="light">
                          Archived
                        </Badge>
                        <Badge color={STATUS_COLORS[event.status]} size="sm" style={{ flexShrink: 0 }}>
                          {STATUS_LABELS[event.status]}
                        </Badge>
                      </Group>
                    </Group>

                    {event.department && (
                      <Text size="xs" c="gray.5" fw={500} mb={6}>
                        {event.department}
                      </Text>
                    )}

                    <Group gap="xs" mb={6}>
                      <Badge variant="outline" size="xs" color="gray">
                        {event.restrictionType}
                      </Badge>
                      {event.ward && (
                        <Badge variant="outline" size="xs" color="gray">
                          {event.ward}
                        </Badge>
                      )}
                    </Group>

                    <Text size="xs" c="gray.5">
                      {dayjs(event.startDate).format('YYYY/MM/DD')} - {dayjs(event.endDate).format('YYYY/MM/DD')}
                    </Text>
                  </Card>
                ))
              )}
            </Stack>
          </Collapse>
        </Stack>
      )}
    </Stack>
  );
}
