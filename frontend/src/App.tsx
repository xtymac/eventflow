import { useEffect, useRef, useState, useCallback } from 'react';
import { Stack, Text, Group } from '@/components/shims';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { IconBell, IconX, IconFileImport, IconMenu2 } from '@tabler/icons-react';
import { useShallow } from 'zustand/shallow';
import { useDisclosure } from './hooks/useDisclosure';
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

  // Sync UI state with URL parameters (filters, tabs, selections)
  useUrlState();

  const [, { toggle: toggleMobile, open: openMobile }] = useDisclosure();
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

  const showLeftSidebar = !isFullScreenMap && desktopOpened;
  const showRightSidebar = detailModalEventId || selectedAssetId || isHistoricalPreviewMode;

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b px-4">
        <Group>
          <Button variant="ghost" size="icon" onClick={toggleDesktop} className="hidden sm:flex">
            <IconMenu2 size={20} />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleMobile} className="sm:hidden">
            <IconMenu2 size={20} />
          </Button>
          <img src="/favicon.svg" alt="EventFlow" width={44} height={44} className="ml-2" />
          <h3 className="text-lg font-semibold">EventFlow</h3>
        </Group>

        {/* Map Search - centered in header */}
        <MapSearch />

        <Group gap="xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleImportExportSidebar}>
                <IconFileImport size={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import / Export</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                  <IconBell size={20} />
                </Button>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-red-500" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
        </Group>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        {showLeftSidebar && (
          <aside className="flex shrink-0 flex-col border-r p-4" style={{ width: sidebarWidth }}>
            <Stack gap="xs" className="mb-4">
              <ToggleGroup
                type="single"
                value={currentView}
                onValueChange={(value) => { if (value) setCurrentView(value as View); }}
                className="w-full"
              >
                {VIEW_OPTIONS.map((opt) => (
                  <ToggleGroupItem key={opt.value} value={opt.value} className="flex-1">
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Stack>

            <ScrollArea className="flex-1">
              {renderSidebarContent()}
            </ScrollArea>
          </aside>
        )}

        {/* Resize Handle */}
        {showLeftSidebar && (
          <div
            className={`sidebar-resize-handle hidden cursor-col-resize sm:block ${isResizing ? 'active' : ''} ${showResizeHint ? 'hint' : ''}`}
            onMouseDown={handleResizeStart}
            style={{
              width: 6,
              ...(showResizeHint ? {} : {
                background: isResizing ? 'hsl(var(--primary))' : 'transparent',
                transition: isResizing ? 'none' : 'background 0.2s',
              }),
            }}
          />
        )}

        {/* Main content */}
        <main className="relative flex-1" style={{ height: 'calc(100vh - 60px)' }}>
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
        </main>

        {/* Right sidebar - Event Details, Asset Details, or Historical Preview */}
        {showRightSidebar && (
          <aside className="flex w-[400px] shrink-0 flex-col border-l" style={{ padding: isHistoricalPreviewMode ? 0 : 16 }}>
            {isHistoricalPreviewMode ? (
              <HistoricalPreviewSidebar />
            ) : selectedAssetId && selectedAssetType ? (
              <>
                <Group justify="space-between" className="mb-4">
                  <Text fw={600}>Asset Details</Text>
                  <Button variant="ghost" size="icon" onClick={() => selectAsset(null)}>
                    <IconX size={18} />
                  </Button>
                </Group>
                <ScrollArea className="flex-1">
                  <AssetDetailPanel assetId={selectedAssetId} assetType={selectedAssetType} />
                </ScrollArea>
              </>
            ) : detailModalEventId ? (
              <>
                <Group justify="space-between" className="mb-4">
                  <Text fw={600}>Event Details</Text>
                  <Button variant="ghost" size="icon" onClick={closeEventDetailModal}>
                    <IconX size={18} />
                  </Button>
                </Group>
                <ScrollArea className="flex-1">
                  <EventDetailPanel eventId={detailModalEventId} showBackButton={false} />
                </ScrollArea>
              </>
            ) : null}
          </aside>
        )}
      </div>

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
    </div>
  );
}

export default App;
