import { useEffect, useRef, useState, useCallback } from 'react';
import { AppShell, Burger, Group, Title, SegmentedControl, Stack, ActionIcon, Tooltip, ScrollArea, Text, Indicator, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBell, IconX, IconFileImport } from '@tabler/icons-react';
import { useShallow } from 'zustand/shallow';
import { EventList } from './features/events/EventList';
import { AssetList } from './features/assets/AssetList';
import { InspectionList } from './features/inspections/InspectionList';
import { EventDetailPanel } from './features/events/EventDetailPanel';
import { DecisionModal } from './features/events/DecisionModal';
import { MapView } from './components/MapView';
import { MapSearch } from './components/MapSearch';
import { NotificationSidebar } from './components/NotificationSidebar';
import { ImportExportSidebar } from './components/ImportExportSidebar';
import { useUIStore } from './stores/uiStore';
import { useNotificationStore } from './stores/notificationStore';
import { useNotifications } from './hooks/useNotifications';
import { EventEditorOverlay } from './features/events/EventEditorOverlay';
// Phase 0: RoadUpdateModeOverlay disabled - Road editing is frozen
// import { RoadUpdateModeOverlay } from './features/assets/RoadUpdateModeOverlay';
import { InspectionEditorOverlay } from './features/inspections/InspectionEditorOverlay';
import { InspectionDetailModal } from './features/inspections/InspectionDetailModal';
import { AssetDetailPanel } from './features/assets/AssetDetailPanel';
import { ImportWizard } from './features/import/ImportWizard';
import { ExportBboxConfirmOverlay } from './features/import/components/ExportBboxConfirmOverlay';
import { ImportPreviewOverlay } from './features/import/components/ImportPreviewOverlay';
import { HistoricalPreviewSidebar } from './features/import/components/HistoricalPreviewSidebar';
import { useUrlState } from './hooks/useUrlState';

type View = 'events' | 'assets' | 'inspections';

const VIEW_OPTIONS = [
  { label: 'Events', value: 'events' },
  { label: 'Assets', value: 'assets' },
  { label: 'Inspections', value: 'inspections' },
];

const SIDEBAR_WIDTH_KEY = 'eventflow-sidebar-width';
const SIDEBAR_HINT_SHOWN_KEY = 'eventflow-sidebar-hint-shown';
const DEFAULT_SIDEBAR_WIDTH = 400;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 600;

function App() {
  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showResizeHint, setShowResizeHint] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Show hint animation once per page refresh
  useEffect(() => {
    const hintShown = sessionStorage.getItem(SIDEBAR_HINT_SHOWN_KEY);
    if (!hintShown) {
      // Delay the hint to let the page and list load first
      const timer = setTimeout(() => {
        setShowResizeHint(true);
        sessionStorage.setItem(SIDEBAR_HINT_SHOWN_KEY, 'true');
        // Remove hint class after animation completes (2 cycles * 0.5s = 1s)
        setTimeout(() => setShowResizeHint(false), 1200);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(Math.max(resizeRef.current.startWidth + delta, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);
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
    // Phase 0: Road Update Mode disabled - these are no longer used
    // roadUpdateEventId,
    // exitRoadUpdateMode,
    isInspectionFormOpen,
    selectedInspectionForEdit,
    inspectionFormEventId,
    inspectionFormAssetId,
    closeInspectionForm,
    selectedInspectionId,
    selectInspection,
    selectedAssetId,
    selectedAssetType,
    selectAsset,
    isHistoricalPreviewMode,
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
    // Phase 0: Road Update Mode disabled - these are no longer used
    // roadUpdateEventId: state.roadUpdateEventId,
    // exitRoadUpdateMode: state.exitRoadUpdateMode,
    isInspectionFormOpen: state.isInspectionFormOpen,
    selectedInspectionForEdit: state.selectedInspectionForEdit,
    inspectionFormEventId: state.inspectionFormEventId,
    inspectionFormAssetId: state.inspectionFormAssetId,
    closeInspectionForm: state.closeInspectionForm,
    selectedInspectionId: state.selectedInspectionId,
    selectInspection: state.selectInspection,
    selectedAssetId: state.selectedAssetId,
    selectedAssetType: state.selectedAssetType,
    selectAsset: state.selectAsset,
    isHistoricalPreviewMode: state.isHistoricalPreviewMode,
  })));

  // Notification state
  const { unreadCount } = useNotifications();
  const toggleSidebar = useNotificationStore((s) => s.toggleSidebar);
  const toggleImportExportSidebar = useUIStore((s) => s.toggleImportExportSidebar);
  const isEditing = isEventFormOpen || isRoadUpdateModeActive || isInspectionFormOpen;
  const isFullScreenMap = isEditing || isHistoricalPreviewMode;
  const prevDetailModalEventId = useRef(detailModalEventId);
  const prevSelectedAssetId = useRef(selectedAssetId);

  // When right sidebar closes (event or asset detail), reopen left sidebar
  useEffect(() => {
    if (prevDetailModalEventId.current && !detailModalEventId) {
      openDesktop();
      openMobile();
    }
    prevDetailModalEventId.current = detailModalEventId;
  }, [detailModalEventId, openDesktop, openMobile]);

  useEffect(() => {
    if (prevSelectedAssetId.current && !selectedAssetId) {
      openDesktop();
      openMobile();
    }
    prevSelectedAssetId.current = selectedAssetId;
  }, [selectedAssetId, openDesktop, openMobile]);

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
          width: sidebarWidth,
          breakpoint: 'sm',
          collapsed: { mobile: isFullScreenMap || !mobileOpened, desktop: isFullScreenMap || !desktopOpened },
        }}
        aside={{
          width: 400,
          breakpoint: 'sm',
          collapsed: { mobile: !detailModalEventId && !selectedAssetId && !isHistoricalPreviewMode, desktop: !detailModalEventId && !selectedAssetId && !isHistoricalPreviewMode },
        }}
        padding={0}
      >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={!isFullScreenMap && mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Burger
              opened={!isFullScreenMap && desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
            />
            <img src="/favicon.svg" alt="EventFlow" width={44} height={44} style={{ marginLeft: 8 }} />
            <Title order={3}>EventFlow</Title>
          </Group>

          {/* Map Search - centered in header */}
          <MapSearch />

          <Group gap="xs">
            <Tooltip label="Import / Export">
              <ActionIcon variant="subtle" onClick={toggleImportExportSidebar}>
                <IconFileImport size={20} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Notifications">
              <Indicator size={8} disabled={unreadCount === 0} color="red" processing>
                <ActionIcon variant="subtle" onClick={toggleSidebar}>
                  <IconBell size={20} />
                </ActionIcon>
              </Indicator>
            </Tooltip>
          </Group>
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

      {/* Resize Handle - positioned fixed, only visible when sidebar is open on desktop */}
      {!isFullScreenMap && desktopOpened && (
        <Box
          className={`sidebar-resize-handle ${isResizing ? 'active' : ''} ${showResizeHint ? 'hint' : ''}`}
          onMouseDown={handleResizeStart}
          visibleFrom="sm"
          style={{
            position: 'fixed',
            top: 60,
            left: sidebarWidth - 3,
            width: 6,
            height: 'calc(100vh - 60px)',
            cursor: 'col-resize',
            zIndex: 100,
            // Don't set inline background/transition when hint animation is playing
            ...(showResizeHint ? {} : {
              background: isResizing ? 'var(--mantine-color-blue-5)' : 'transparent',
              transition: isResizing ? 'none' : 'background 0.2s, left 0.1s',
            }),
          }}
        />
      )}

      <AppShell.Main style={{ height: 'calc(100vh - 60px)', position: 'relative' }}>
        <MapView />

        {/* Export bbox confirmation overlay */}
        <ExportBboxConfirmOverlay />

        {/* Import preview overlay (when viewing a road from review step) */}
        <ImportPreviewOverlay />

        {isEventFormOpen && (
          <EventEditorOverlay
            eventId={editingEventId}
            duplicateEventId={duplicateEventId}
            onClose={closeEventForm}
          />
        )}

        {/* Phase 0: RoadUpdateModeOverlay disabled - Road editing is frozen
        {isRoadUpdateModeActive && roadUpdateEventId && (
          <RoadUpdateModeOverlay
            eventId={roadUpdateEventId}
            onClose={exitRoadUpdateMode}
          />
        )}
        */}

        {isInspectionFormOpen && (
          <InspectionEditorOverlay
            inspectionId={selectedInspectionForEdit}
            prefillEventId={inspectionFormEventId}
            prefillAssetId={inspectionFormAssetId}
            onClose={closeInspectionForm}
          />
        )}
      </AppShell.Main>

      {/* Right sidebar - Event Details, Asset Details, or Historical Preview */}
      <AppShell.Aside p={isHistoricalPreviewMode ? 0 : 'md'}>
        {isHistoricalPreviewMode ? (
          <HistoricalPreviewSidebar />
        ) : selectedAssetId && selectedAssetType ? (
          <>
            <AppShell.Section>
              <Group justify="space-between" mb="md">
                <Text fw={600}>Asset Details</Text>
                <ActionIcon variant="subtle" color="gray" onClick={() => selectAsset(null)}>
                  <IconX size={18} />
                </ActionIcon>
              </Group>
            </AppShell.Section>
            <AppShell.Section grow component={ScrollArea} type="hover" scrollbarSize={10} offsetScrollbars>
              <AssetDetailPanel assetId={selectedAssetId} assetType={selectedAssetType} />
            </AppShell.Section>
          </>
        ) : detailModalEventId ? (
          <>
            <AppShell.Section>
              <Group justify="space-between" mb="md">
                <Text fw={600}>Event Details</Text>
                <ActionIcon variant="subtle" color="gray" onClick={closeEventDetailModal}>
                  <IconX size={18} />
                </ActionIcon>
              </Group>
            </AppShell.Section>
            <AppShell.Section grow component={ScrollArea} type="hover" scrollbarSize={10} offsetScrollbars>
              <EventDetailPanel eventId={detailModalEventId} showBackButton={false} />
            </AppShell.Section>
          </>
        ) : null}
      </AppShell.Aside>

      <DecisionModal />

      {selectedInspectionId && (
        <InspectionDetailModal
          inspectionId={selectedInspectionId}
          onClose={() => selectInspection(null)}
        />
      )}

      {/* Import Wizard Modal */}
      <ImportWizard />

      {/* Notification Sidebar - slides from right */}
      <NotificationSidebar />

      {/* Import/Export Sidebar - slides from right */}
      <ImportExportSidebar />
    </AppShell>
  );
}

export default App;
