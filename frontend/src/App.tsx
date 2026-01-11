import { useEffect, useRef } from 'react';
import { AppShell, Burger, Group, Title, SegmentedControl, Stack, ActionIcon, Tooltip, ScrollArea, Text, Indicator } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBell, IconX } from '@tabler/icons-react';
import { useShallow } from 'zustand/shallow';
import { EventList } from './features/events/EventList';
import { AssetList } from './features/assets/AssetList';
import { InspectionList } from './features/inspections/InspectionList';
import { EventDetailPanel } from './features/events/EventDetailPanel';
import { DecisionModal } from './features/events/DecisionModal';
import { MapView } from './components/MapView';
import { MapSearch } from './components/MapSearch';
import { NotificationSidebar } from './components/NotificationSidebar';
import { useUIStore } from './stores/uiStore';
import { useNotificationStore } from './stores/notificationStore';
import { useNotifications } from './hooks/useNotifications';
import { EventEditorOverlay } from './features/events/EventEditorOverlay';
import { RoadUpdateModeOverlay } from './features/assets/RoadUpdateModeOverlay';
import { InspectionEditorOverlay } from './features/inspections/InspectionEditorOverlay';
import { InspectionDetailModal } from './features/inspections/InspectionDetailModal';
import { useUrlState } from './hooks/useUrlState';

type View = 'events' | 'assets' | 'inspections';

const VIEW_OPTIONS = [
  { label: 'Events', value: 'events' },
  { label: 'Assets', value: 'assets' },
  { label: 'Inspections', value: 'inspections' },
];

function App() {
  // Sync UI state with URL parameters (filters, tabs, selections)
  useUrlState();

  const [mobileOpened, { toggle: toggleMobile, open: openMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop, open: openDesktop }] = useDisclosure(true);
  const {
    currentView,
    setCurrentView,
    isEventFormOpen,
    editingEventId,
    duplicateEventId,
    closeEventForm,
    detailModalEventId,
    closeEventDetailModal,
    isRoadUpdateModeActive,
    roadUpdateEventId,
    exitRoadUpdateMode,
    isInspectionFormOpen,
    selectedInspectionForEdit,
    inspectionFormEventId,
    inspectionFormAssetId,
    closeInspectionForm,
    selectedInspectionId,
    selectInspection,
  } = useUIStore(useShallow((state) => ({
    currentView: state.currentView,
    setCurrentView: state.setCurrentView,
    isEventFormOpen: state.isEventFormOpen,
    editingEventId: state.editingEventId,
    duplicateEventId: state.duplicateEventId,
    closeEventForm: state.closeEventForm,
    detailModalEventId: state.detailModalEventId,
    closeEventDetailModal: state.closeEventDetailModal,
    isRoadUpdateModeActive: state.isRoadUpdateModeActive,
    roadUpdateEventId: state.roadUpdateEventId,
    exitRoadUpdateMode: state.exitRoadUpdateMode,
    isInspectionFormOpen: state.isInspectionFormOpen,
    selectedInspectionForEdit: state.selectedInspectionForEdit,
    inspectionFormEventId: state.inspectionFormEventId,
    inspectionFormAssetId: state.inspectionFormAssetId,
    closeInspectionForm: state.closeInspectionForm,
    selectedInspectionId: state.selectedInspectionId,
    selectInspection: state.selectInspection,
  })));

  // Notification state
  const { unreadCount } = useNotifications();
  const toggleSidebar = useNotificationStore((s) => s.toggleSidebar);
  const isEditing = isEventFormOpen || isRoadUpdateModeActive || isInspectionFormOpen;
  const prevDetailModalEventId = useRef(detailModalEventId);

  // When right sidebar closes, reopen left sidebar
  useEffect(() => {
    if (prevDetailModalEventId.current && !detailModalEventId) {
      openDesktop();
      openMobile();
    }
    prevDetailModalEventId.current = detailModalEventId;
  }, [detailModalEventId, openDesktop, openMobile]);

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
          collapsed: { mobile: isEditing || !mobileOpened, desktop: isEditing || !desktopOpened },
        }}
        aside={{
          width: 400,
          breakpoint: 'sm',
          collapsed: { mobile: !detailModalEventId, desktop: !detailModalEventId },
        }}
        padding={0}
      >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={!isEditing && mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Burger
              opened={!isEditing && desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
            />
            <img src="/favicon.svg" alt="EventFlow" width={44} height={44} style={{ marginLeft: 8 }} />
            <Title order={3}>EventFlow</Title>
          </Group>

          {/* Map Search - centered in header */}
          <MapSearch />

          <Tooltip label="Notifications">
            <Indicator label={unreadCount} size={16} disabled={unreadCount === 0} color="red">
              <ActionIcon variant="subtle" onClick={toggleSidebar}>
                <IconBell size={20} />
              </ActionIcon>
            </Indicator>
          </Tooltip>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section>
          <Stack gap="xs" mb="md">
            <SegmentedControl
              value={currentView}
              onChange={(value) => setCurrentView(value as View)}
              data={VIEW_OPTIONS}
              fullWidth
            />
          </Stack>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} type="hover" scrollbarSize={10} offsetScrollbars key={currentView}>
          {renderSidebarContent()}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ height: 'calc(100vh - 60px)', position: 'relative' }}>
        <MapView />

        {isEventFormOpen && (
          <EventEditorOverlay
            eventId={editingEventId}
            duplicateEventId={duplicateEventId}
            onClose={closeEventForm}
          />
        )}

        {isRoadUpdateModeActive && roadUpdateEventId && (
          <RoadUpdateModeOverlay
            eventId={roadUpdateEventId}
            onClose={exitRoadUpdateMode}
          />
        )}

        {isInspectionFormOpen && (
          <InspectionEditorOverlay
            inspectionId={selectedInspectionForEdit}
            prefillEventId={inspectionFormEventId}
            prefillAssetId={inspectionFormAssetId}
            onClose={closeInspectionForm}
          />
        )}
      </AppShell.Main>

      {/* Event Detail Aside (right sidebar) */}
      <AppShell.Aside p="md">
        <AppShell.Section>
          <Group justify="space-between" mb="md">
            <Text fw={600}>Event Details</Text>
            <ActionIcon variant="subtle" color="gray" onClick={closeEventDetailModal}>
              <IconX size={18} />
            </ActionIcon>
          </Group>
        </AppShell.Section>
        <AppShell.Section grow component={ScrollArea} type="hover" scrollbarSize={10} offsetScrollbars>
          {detailModalEventId && (
            <EventDetailPanel eventId={detailModalEventId} showBackButton={false} />
          )}
        </AppShell.Section>
      </AppShell.Aside>

      <DecisionModal />

      {selectedInspectionId && (
        <InspectionDetailModal
          inspectionId={selectedInspectionId}
          onClose={() => selectInspection(null)}
        />
      )}

      {/* Notification Sidebar - slides from right */}
      <NotificationSidebar />
    </AppShell>
  );
}

export default App;
