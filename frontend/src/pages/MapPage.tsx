import { useEffect, useRef, useState, useCallback } from 'react';
import { Burger, Group, SegmentedControl, ActionIcon, Tooltip, ScrollArea, Text, Indicator, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBell, IconX, IconFileImport } from '@tabler/icons-react';
import { useShallow } from 'zustand/shallow';
import { EventList } from '../features/events/EventList';
import { AssetList } from '../features/assets/AssetList';
import { InspectionList } from '../features/inspections/InspectionList';
import { EventDetailPanel } from '../features/events/EventDetailPanel';
import { DecisionModal } from '../features/events/DecisionModal';
import { MapView } from '../components/MapView';
import { MapSearch } from '../components/MapSearch';
import { NotificationSidebar } from '../components/NotificationSidebar';
import { ImportExportSidebar } from '../components/ImportExportSidebar';
import { useUIStore } from '../stores/uiStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useNotifications } from '../hooks/useNotifications';
import { EventEditorOverlay } from '../features/events/EventEditorOverlay';
import { InspectionEditorOverlay } from '../features/inspections/InspectionEditorOverlay';
import { InspectionDetailModal } from '../features/inspections/InspectionDetailModal';
import { AssetDetailPanel } from '../features/assets/AssetDetailPanel';
import { ImportWizard } from '../features/import/ImportWizard';
import { ExportBboxConfirmOverlay } from '../features/import/components/ExportBboxConfirmOverlay';
import { ImportPreviewOverlay } from '../features/import/components/ImportPreviewOverlay';
import { HistoricalPreviewSidebar } from '../features/import/components/HistoricalPreviewSidebar';
import { useUrlState } from '../hooks/useUrlState';

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

export function MapPage() {
  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showResizeHint, setShowResizeHint] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const hintShown = sessionStorage.getItem(SIDEBAR_HINT_SHOWN_KEY);
    if (!hintShown) {
      const timer = setTimeout(() => {
        setShowResizeHint(true);
        sessionStorage.setItem(SIDEBAR_HINT_SHOWN_KEY, 'true');
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

  useUrlState();

  const [sidebarOpen, { toggle: toggleSidebar, open: openSidebar }] = useDisclosure(true);
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

  const { unreadCount } = useNotifications();
  const toggleNotifications = useNotificationStore((s) => s.toggleSidebar);
  const toggleImportExportSidebar = useUIStore((s) => s.toggleImportExportSidebar);
  const isEditing = isEventFormOpen || isRoadUpdateModeActive || isInspectionFormOpen;
  const isFullScreenMap = isEditing || isHistoricalPreviewMode;

  const prevDetailModalEventId = useRef(detailModalEventId);
  const prevSelectedAssetId = useRef(selectedAssetId);

  useEffect(() => {
    if (prevDetailModalEventId.current && !detailModalEventId) {
      openSidebar();
    }
    prevDetailModalEventId.current = detailModalEventId;
  }, [detailModalEventId, openSidebar]);

  useEffect(() => {
    if (prevSelectedAssetId.current && !selectedAssetId) {
      openSidebar();
    }
    prevSelectedAssetId.current = selectedAssetId;
  }, [selectedAssetId, openSidebar]);

  const showLeftSidebar = !isFullScreenMap && sidebarOpen;
  const showRightAside = detailModalEventId || selectedAssetId || isHistoricalPreviewMode;

  const renderSidebarContent = () => {
    switch (currentView) {
      case 'events': return <EventList />;
      case 'assets': return <AssetList />;
      case 'inspections': return <InspectionList />;
      default: return <EventList />;
    }
  };

  return (
    <Box style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      {showLeftSidebar && (
        <Box
          style={{
            width: sidebarWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--mantine-color-gray-3)',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* Sidebar Header */}
          <Box p="md" pb="xs">
            <Group justify="space-between" mb="xs">
              <MapSearch />
              <Group gap="xs">
                <Tooltip label="Import / Export">
                  <ActionIcon variant="subtle" onClick={toggleImportExportSidebar}>
                    <IconFileImport size={20} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Notifications">
                  <Indicator size={8} disabled={unreadCount === 0} color="red" processing>
                    <ActionIcon variant="subtle" onClick={toggleNotifications}>
                      <IconBell size={20} />
                    </ActionIcon>
                  </Indicator>
                </Tooltip>
              </Group>
            </Group>
            <SegmentedControl
              value={currentView}
              onChange={(value) => setCurrentView(value as View)}
              data={VIEW_OPTIONS}
              fullWidth
              size="xs"
            />
          </Box>
          <ScrollArea style={{ flex: 1 }} type="hover" scrollbarSize={10} offsetScrollbars>
            <Box p="md" pt="xs">
              {renderSidebarContent()}
            </Box>
          </ScrollArea>
        </Box>
      )}

      {/* Resize Handle */}
      {showLeftSidebar && (
        <Box
          className={`sidebar-resize-handle ${isResizing ? 'active' : ''} ${showResizeHint ? 'hint' : ''}`}
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            top: 0,
            left: sidebarWidth - 3,
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 100,
            ...(showResizeHint ? {} : {
              background: isResizing ? 'var(--mantine-color-blue-5)' : 'transparent',
              transition: isResizing ? 'none' : 'background 0.2s, left 0.1s',
            }),
          }}
        />
      )}

      {/* Sidebar toggle when collapsed */}
      {!showLeftSidebar && !isFullScreenMap && (
        <Box
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
          }}
        >
          <Burger opened={false} onClick={toggleSidebar} size="sm" />
        </Box>
      )}

      {/* Map Area */}
      <Box style={{ flex: 1, position: 'relative', height: '100%' }}>
        <MapView />

        <ExportBboxConfirmOverlay />
        <ImportPreviewOverlay />

        {isEventFormOpen && (
          <EventEditorOverlay
            eventId={editingEventId}
            duplicateEventId={duplicateEventId}
            onClose={closeEventForm}
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
      </Box>

      {/* Right Aside */}
      {showRightAside && (
        <Box
          style={{
            width: 400,
            flexShrink: 0,
            borderLeft: '1px solid var(--mantine-color-gray-3)',
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          p={isHistoricalPreviewMode ? 0 : 'md'}
        >
          {isHistoricalPreviewMode ? (
            <HistoricalPreviewSidebar />
          ) : selectedAssetId && selectedAssetType ? (
            <>
              <Group justify="space-between" mb="md">
                <Text fw={600}>Asset Details</Text>
                <ActionIcon variant="subtle" color="gray" onClick={() => selectAsset(null)}>
                  <IconX size={18} />
                </ActionIcon>
              </Group>
              <ScrollArea style={{ flex: 1 }} type="hover" scrollbarSize={10} offsetScrollbars>
                <AssetDetailPanel assetId={selectedAssetId} assetType={selectedAssetType} />
              </ScrollArea>
            </>
          ) : detailModalEventId ? (
            <>
              <Group justify="space-between" mb="md">
                <Text fw={600}>Event Details</Text>
                <ActionIcon variant="subtle" color="gray" onClick={closeEventDetailModal}>
                  <IconX size={18} />
                </ActionIcon>
              </Group>
              <ScrollArea style={{ flex: 1 }} type="hover" scrollbarSize={10} offsetScrollbars>
                <EventDetailPanel eventId={detailModalEventId} showBackButton={false} />
              </ScrollArea>
            </>
          ) : null}
        </Box>
      )}

      <DecisionModal />

      {selectedInspectionId && (
        <InspectionDetailModal
          inspectionId={selectedInspectionId}
          onClose={() => selectInspection(null)}
        />
      )}

      <ImportWizard />
      <NotificationSidebar />
      <ImportExportSidebar />
    </Box>
  );
}
