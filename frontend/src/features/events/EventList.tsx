import { useState } from 'react';
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
import { IconSearch, IconPlus, IconFilter, IconChevronDown, IconX } from '@tabler/icons-react';
import { useEvents } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { ConstructionEvent, EventStatus } from '@nagoya/shared';
import dayjs from 'dayjs';

const STATUS_COLORS: Record<EventStatus, string> = {
  planned: 'blue',
  active: 'yellow',
  ended: 'gray',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  ended: 'Ended',
};

const formatLocalDate = (date: Date | null): string | undefined => {
  if (!date) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function EventList() {
  // UI-only state (not persisted)
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Persisted filter state from store
  const { selectedEventId, selectEvent, openEventForm, eventFilters, setEventFilter, resetEventFilters } = useUIStore();
  const { status: statusFilter, search, department, dateRange } = eventFilters;

  const { data, isLoading, error } = useEvents({
    name: search || undefined,
    status: statusFilter as EventStatus | undefined,
    department: department || undefined,
    startDateFrom: formatLocalDate(dateRange.from),
    startDateTo: formatLocalDate(dateRange.to),
  });

  // Compute active filter count for badge display
  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (department ? 1 : 0) +
    (dateRange.from || dateRange.to ? 1 : 0) +
    (search ? 1 : 0);

  const events = data?.data || [];

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
        onClick={() => setFiltersOpen((prev) => !prev)}
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
              padding="sm"
              radius="sm"
              withBorder
              style={{
                cursor: 'pointer',
                borderColor: selectedEventId === event.id ? 'var(--mantine-color-blue-5)' : undefined,
                backgroundColor: selectedEventId === event.id ? 'var(--mantine-color-blue-0)' : undefined,
              }}
              onClick={() => selectEvent(event.id)}
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
    </Stack>
  );
}
