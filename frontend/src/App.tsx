import { AppShell, Burger, Group, Title, SegmentedControl, Stack, ActionIcon, Tooltip, ScrollArea, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMap, IconRefresh } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { EventList } from './features/events/EventList';
import { AssetList } from './features/assets/AssetList';
import { InspectionList } from './features/inspections/InspectionList';
import { EventForm } from './features/events/EventForm';
import { EventDetailModal } from './features/events/EventDetailModal';
import { DecisionModal } from './features/events/DecisionModal';
import { MapView } from './components/MapView';
import { useUIStore } from './stores/uiStore';

type View = 'events' | 'assets' | 'inspections';

function App() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const { currentView, setCurrentView, isEventFormOpen, editingEventId, closeEventForm, detailModalEventId, closeEventDetailModal } = useUIStore();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  const renderSidebarContent = () => {
    switch (currentView) {
      case 'events':
        return <EventList />;
      case 'assets':
        return <AssetList />;
      case 'inspections':
        return <InspectionList />;
      default:
        return <EventList />;
    }
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 400,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Burger
              opened={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
            />
            <IconMap size={28} stroke={1.5} />
            <Title order={3}>Nagoya Construction Lifecycle</Title>
          </Group>
          <Tooltip label="Refresh data">
            <ActionIcon variant="subtle" onClick={handleRefresh}>
              <IconRefresh size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section>
          <Stack gap="xs" mb="md">
            <SegmentedControl
              value={currentView}
              onChange={(value) => setCurrentView(value as View)}
              data={[
                { label: 'Events', value: 'events' },
                { label: 'Assets', value: 'assets' },
                { label: 'Inspections', value: 'inspections' },
              ]}
              fullWidth
            />
          </Stack>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} type="hover" scrollbarSize={10} offsetScrollbars key={currentView}>
          {renderSidebarContent()}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ height: 'calc(100vh - 60px)' }}>
        <MapView />
      </AppShell.Main>

      {/* Event Form Modal */}
      <Modal
        opened={isEventFormOpen}
        onClose={closeEventForm}
        title={editingEventId ? 'Edit Event' : 'Create Event'}
        size="lg"
      >
        <EventForm eventId={editingEventId} onClose={closeEventForm} />
      </Modal>

      {/* Event Detail Modal (from map tooltip) */}
      {detailModalEventId && (
        <EventDetailModal
          eventId={detailModalEventId}
          onClose={closeEventDetailModal}
        />
      )}

      <DecisionModal />
    </AppShell>
  );
}

export default App;
