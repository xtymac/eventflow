import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Group, ActionIcon, ScrollArea, Text } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconX } from '@tabler/icons-react';
import { ChevronRight, Printer, FileDown, Send, Layers, Map as MapIcon } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { AnimatePresence, motion } from 'motion/react';
import { AdminDataNavigationPanel } from '../features/admin-demo/AdminDataNavigationPanel';
import { EventDetailPanel } from '../features/events/EventDetailPanel';
import { DecisionModal } from '../features/events/DecisionModal';
import { MapView } from '../components/MapView';
import { MapSearch } from '../components/MapSearch';
import { NotificationSidebar } from '../components/NotificationSidebar';
import { ImportExportSidebar } from '../components/ImportExportSidebar';
import { useUIStore } from '../stores/uiStore';
import { useMapStore, type MapTheme } from '../stores/mapStore';
import { EventEditorOverlay } from '../features/events/EventEditorOverlay';
import { InspectionEditorOverlay } from '../features/inspections/InspectionEditorOverlay';
import { InspectionDetailModal } from '../features/inspections/InspectionDetailModal';
import { AssetDetailPanel } from '../features/assets/AssetDetailPanel';
import { ParkPreviewPanel } from './parks/ParkPreviewPanel';
import { CURATED_PARKS } from '../data/curatedParks';
import { ImportWizard } from '../features/import/ImportWizard';

const PARKS_BY_ID = new Map(CURATED_PARKS.map(p => [p.id, p]));
import { ExportBboxConfirmOverlay } from '../features/import/components/ExportBboxConfirmOverlay';
import { ImportPreviewOverlay } from '../features/import/components/ImportPreviewOverlay';
import { HistoricalPreviewSidebar } from '../features/import/components/HistoricalPreviewSidebar';
import { useUrlState } from '../hooks/useUrlState';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function MapPage() {
  useUrlState();
  const navigate = useNavigate();

  const [panelOpen, { toggle: togglePanel, open: openPanel }] = useDisclosure(true);
  const {
    isEventFormOpen,
    editingEventId,
    duplicateEventId,
    closeEventForm,
    detailModalEventId,
    closeEventDetailModal,
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
    isEventFormOpen: state.isEventFormOpen,
    editingEventId: state.editingEventId,
    duplicateEventId: state.duplicateEventId,
    closeEventForm: state.closeEventForm,
    detailModalEventId: state.detailModalEventId,
    closeEventDetailModal: state.closeEventDetailModal,
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

  const mapTheme = useMapStore((s) => s.mapTheme);
  const setMapTheme = useMapStore((s) => s.setMapTheme);

  const THEME_LABELS: Record<MapTheme, string> = {
    standard: 'OSM Standard',
    voyager: 'CARTO Voyager',
    light: 'CARTO Light',
    dark: 'CARTO Dark',
  };

  const isEditing = isEventFormOpen || isInspectionFormOpen;
  const isFullScreenMap = isEditing || isHistoricalPreviewMode;

  const prevDetailModalEventId = useRef(detailModalEventId);
  const prevSelectedAssetId = useRef(selectedAssetId);

  useEffect(() => {
    if (prevDetailModalEventId.current && !detailModalEventId) {
      openPanel();
    }
    prevDetailModalEventId.current = detailModalEventId;
  }, [detailModalEventId, openPanel]);

  useEffect(() => {
    prevSelectedAssetId.current = selectedAssetId;
  }, [selectedAssetId]);

  // Resize state for Right Aside
  const [asideWidth, setAsideWidth] = useState(() => {
    const saved = localStorage.getItem('map-right-aside-width');
    return saved ? Math.min(Math.max(parseInt(saved, 10), 320), 800) : 400;
  });
  const [isResizingAside, setIsResizingAside] = useState(false);
  const asideResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleAsideResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingAside(true);
    asideResizeRef.current = { startX: e.clientX, startWidth: asideWidth };
  }, [asideWidth]);

  useEffect(() => {
    if (!isResizingAside) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!asideResizeRef.current) return;
      // For right aside, moving left (smaller clientX) increases width
      const delta = asideResizeRef.current.startX - e.clientX;
      const newWidth = Math.min(Math.max(asideResizeRef.current.startWidth + delta, 320), 800);
      setAsideWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingAside(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAside]);

  useEffect(() => {
    if (!isResizingAside) {
      localStorage.setItem('map-right-aside-width', String(asideWidth));
    }
  }, [isResizingAside, asideWidth]);

  const isMobile = useMediaQuery('(max-width: 639px)');

  const showLayerPanel = !isFullScreenMap && panelOpen;
  const showRightAside = detailModalEventId || (selectedAssetId && selectedAssetType) || isHistoricalPreviewMode;

  return (
    <Box style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Map Area — Full width, panels float over it */}
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

        {/* Floating layer panel + collapse tab */}
        <AnimatePresence>
          {showLayerPanel && (
            <motion.div
              initial={{ x: -350, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -350, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute left-4 top-4 z-10 hidden sm:flex items-center"
            >
              <div
                className="flex w-[300px] flex-col rounded-[10px] border border-border bg-background shadow-lg"
                data-testid="map-layer-panel"
              >
                <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-4">
                  <div className="flex flex-col gap-5">
                    <MapSearch />
                    <AdminDataNavigationPanel />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={togglePanel}
                className="flex h-[58px] w-[29px] items-center justify-center rounded-r-[10px] border border-l-0 border-border bg-background shadow-md"
                data-testid="map-panel-toggle"
              >
                <ChevronRight size={20} className="text-foreground rotate-180" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile: panel without tab */}
        <AnimatePresence>
          {showLayerPanel && (
            <motion.div
              initial={{ y: -50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute left-4 right-4 top-4 z-10 flex sm:hidden flex-col rounded-[10px] border border-border bg-background shadow-lg"
              data-testid="map-layer-panel-mobile"
            >
              <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-4">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <Text fw={600} size="sm">Search & Layers</Text>
                    <ActionIcon variant="subtle" color="gray" onClick={togglePanel}>
                      <IconX size={18} />
                    </ActionIcon>
                  </div>
                  <MapSearch />
                  <AdminDataNavigationPanel />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed panel tab */}
        <AnimatePresence>
          {!isFullScreenMap && !showLayerPanel && (
            <motion.button
              type="button"
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={togglePanel}
              className="absolute left-0 top-4 z-10 hidden sm:flex h-[58px] w-[29px] items-center justify-center rounded-r-[10px] border border-border bg-background shadow-md"
              data-testid="map-panel-toggle"
            >
              <ChevronRight size={20} className="text-foreground" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Mobile collapsed panel button */}
        <AnimatePresence>
          {!isFullScreenMap && !showLayerPanel && (
            <motion.button
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={togglePanel}
              className="absolute left-4 top-4 z-10 flex sm:hidden h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-background shadow-md"
              data-testid="map-panel-toggle-mobile"
            >
              <Layers size={20} className="text-foreground" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Action buttons (top-right) — print, download, send */}
        {!isFullScreenMap && (
          <TooltipProvider delayDuration={300}>
            <div
              className="absolute right-4 top-4 z-10 flex rounded-lg"
              style={{ boxShadow: 'var(--lg-shadow-1-x, 0) var(--lg-shadow-1-y, 10px) var(--lg-shadow-1-blur, 15px) var(--lg-shadow-1-spread, -3px) var(--lg-color, rgba(0, 0, 0, 0.10)), var(--lg-shadow-2-x, 0) var(--lg-shadow-2-y, 4px) var(--lg-shadow-2-blur, 6px) var(--lg-shadow-2-spread, -4px) var(--lg-color, rgba(0, 0, 0, 0.10))' }}
              data-testid="map-action-buttons"
            >
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="default"
                        size="icon"
                        className="border-0 rounded-none rounded-l-lg"
                        data-testid="map-action-theme"
                      >
                        <MapIcon size={20} />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{THEME_LABELS[mapTheme]}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={mapTheme} onValueChange={(v) => setMapTheme(v as MapTheme)}>
                    {(Object.keys(THEME_LABELS) as MapTheme[]).map((key) => (
                      <DropdownMenuRadioItem key={key} value={key}>
                        {THEME_LABELS[key]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    className="border-0 rounded-none"
                    data-testid="map-action-print"
                    onClick={() => window.print()}
                  >
                    <Printer size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Map Printing</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    className="border-0 rounded-none"
                    data-testid="map-action-download"
                  >
                    <FileDown size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Export map as PDF</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    className="border-0 rounded-none rounded-r-lg"
                    data-testid="map-action-send"
                  >
                    <Send size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Share map view via URL</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )}
      </Box>

      {/* Right Aside */}
      {showRightAside && (
        <Box
          className="fixed inset-0 z-50 w-full sm:absolute sm:left-auto sm:z-20 bg-background sm:shadow-lg"
          style={{
            width: isMobile ? undefined : asideWidth,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          p={isHistoricalPreviewMode || (selectedAssetType === 'green-space') ? 0 : 'md'}
        >
          {/* Resize Handle - left edge (visible only on sm+ screens) */}
          {!isMobile && (
            <div
              className={`absolute left-0 top-0 h-full w-1.5 cursor-col-resize z-10 transition-colors ${isResizingAside ? 'bg-primary' : 'hover:bg-primary/30'}`}
              onMouseDown={handleAsideResizeStart}
            />
          )}
          {isHistoricalPreviewMode ? (
            <HistoricalPreviewSidebar />
          ) : selectedAssetId && selectedAssetType === 'green-space' && PARKS_BY_ID.has(selectedAssetId) ? (
            <ParkPreviewPanel
              park={PARKS_BY_ID.get(selectedAssetId)!}
              onClose={() => selectAsset(null)}
              onNavigateToDetail={() => {
                const id = selectedAssetId;
                selectAsset(null);
                navigate(`/assets/parks/${id}`);
              }}
              hiddenTabs={['map']}
            />
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
