import { useParams, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { IconArrowLeft } from '@tabler/icons-react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { Geometry, Feature, Point, Polygon, MultiPolygon } from 'geojson';

// API hooks
import {
  useGreenSpace,
  useParkFacilitiesByPark,
  usePatchGreenSpace,
} from '@/hooks/useApi';

// Geometry editor
import { useEditorState } from '@/features/geometry-editor/hooks/use-editor-state';
import { useMeasurement } from '@/features/geometry-editor/hooks/use-measurement';
import { MapEditor } from '@/features/geometry-editor/components/map-editor';
import { FloatingToolbar } from '@/features/geometry-editor/components/floating-toolbar';
import { StatusBar } from '@/features/geometry-editor/components/status-bar';
import { CoordinateInputDialog } from '@/features/geometry-editor/components/coordinate-input-dialog';
import { flyToLayer } from '@/features/geometry-editor/lib/camera';
import { findContainingPark } from '@/features/geometry-editor/lib/spatial-utils';
import { getEditorModeConfig } from '@/features/geometry-editor/editor-mode-config';
import { MOCK_FEATURES } from '@/features/geometry-editor/mock-data';
import type { ParkFeature, ParkFeatureCollection } from '@/features/geometry-editor/types';
import {
  isLineGeometry,
  isPolygonGeometry,
  getEditableCoords,
} from '@/features/geometry-editor/hooks/use-vertex-edit';

// ─── Data Conversion Helpers ──────────────────────────────────

function mapCategoryToIcon(category?: string): string {
  const map: Record<string, string> = {
    toilet: 'toilet',
    bench: 'bench',
    playground: 'playground',
    swing: 'playground',
    slide: 'playground',
    fountain: 'fountain',
    parking: 'parking',
    light: 'light',
    gate: 'gate',
  };
  return map[category || ''] || 'marker';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function greenSpaceToParkFeature(gs: {
  properties: any;
  geometry: Geometry;
}): ParkFeature {
  return {
    id: gs.properties.id as string,
    type: 'Feature',
    geometry: gs.geometry as Polygon | MultiPolygon,
    properties: {
      type: gs.geometry.type === 'MultiPolygon' ? 'multipolygon' : 'polygon',
      label:
        gs.properties.displayName ||
        gs.properties.nameJa ||
        gs.properties.name ||
        '公園',
      layer: 'park',
    },
  };
}

function facilityToParkFeature(f: Feature<Point>): ParkFeature {
  const props = f.properties || {};
  return {
    id: props.id || (f.id as string) || uuidv4(),
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      type: 'point',
      label: props.name || props.facilityId || '',
      icon: mapCategoryToIcon(props.category),
      layer: 'facilities',
      parkId: props.greenSpaceRef,
    },
  };
}

// ─── ParkEditPage Component ───────────────────────────────────

export function ParkEditPage() {
  const { id: parkId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modeConfig = useMemo(() => getEditorModeConfig("park"), []);

  // ─── API queries ──────────────────────────────────────────
  const parkQuery = useGreenSpace(parkId ?? null);
  const facilitiesQuery = useParkFacilitiesByPark(parkId ?? null);

  const parkData = parkQuery.data;
  const facilitiesData = facilitiesQuery.data;

  // ─── Editor state ─────────────────────────────────────────
  const editor = useEditorState(MOCK_FEATURES);
  const { state } = editor;
  const patchGreenSpace = usePatchGreenSpace();

  // ─── Local state ──────────────────────────────────────────
  const [mapInstance, setMapInstance] = useState<MaplibreMap | null>(null);
  const [coordDialogOpen, setCoordDialogOpen] = useState(false);
  const [splitTargetId, setSplitTargetId] = useState<string | null>(null);

  const dataLoaded = useRef(false);
  const [dataReady, setDataReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const mapInitDone = useRef(false);
  const getSelectedVertexRef = useRef<
    (() => { ringIndex: number; vertexIndex: number } | null) | null
  >(null);

  // ─── Load API data into editor ────────────────────────────
  useEffect(() => {
    if (!parkData || dataLoaded.current) return;

    const parkFeature = greenSpaceToParkFeature(parkData);
    const facilityFeatures: ParkFeature[] =
      facilitiesData?.features?.map((f: unknown) =>
        facilityToParkFeature(f as Feature<Point>)
      ) ?? [];

    const initial: ParkFeatureCollection = {
      type: 'FeatureCollection',
      features: [parkFeature, ...facilityFeatures],
    };

    editor.loadSaved(initial);
    dataLoaded.current = true;
    setDataReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkData, facilitiesData]);

  // ─── Fly to park polygon and enter vertex edit once map is ready ───
  useEffect(() => {
    if (!mapInstance || !dataReady || mapInitDone.current || !parkData) return;
    const parkFeature = greenSpaceToParkFeature(parkData);
    flyToLayer(mapInstance, [parkFeature]);
    editor.selectFeatures([parkFeature.id]);
    editor.enterVertexEdit(parkFeature.id);
    editor.setTool('vertex_edit');
    mapInitDone.current = true;
    // Allow interaction after a short delay to let the fly-to animation settle
    setTimeout(() => setEditorReady(true), 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance, dataReady, parkData]);

  // ─── Clear clip target when leaving clip mode ─────────────
  useEffect(() => {
    if (state.activeTool !== 'draw_clip_polygon') {
      setSplitTargetId(null);
    }
  }, [state.activeTool]);

  // ─── Measurement hook ─────────────────────────────────────
  const measurement = useMeasurement({
    measurementState: state.measurementState,
    setMeasurementState: editor.setMeasurementState,
    setLiveMeasurement: editor.setLiveMeasurement,
    addFeature: editor.addFeature,
  });

  // ─── Auto-link wrapper for addFeature ─────────────────────
  const wrappedEditor = useMemo(
    () => ({
      ...editor,
      addFeature: (feature: ParkFeature) => {
        editor.addFeature(feature);
        // Auto-link: check if the new feature is inside a park polygon
        if (feature.properties.layer !== 'park') {
          const parkFeatures = editor.state.features.features.filter(
            (f) => f.properties.layer === 'park'
          );
          const containingPark = findContainingPark(feature, parkFeatures);
          if (containingPark && feature.properties.parkId !== containingPark.id) {
            setTimeout(() => {
              editor.reassignFeature(feature.id, containingPark.id);
              toast.success(
                `施設を「${containingPark.properties.label || '公園'}」にリンクしました`
              );
            }, 0);
          }
        }
      },
    }),
    [editor]
  );

  // ─── Handle tool changes ──────────────────────────────────
  const handleSetTool = useCallback(
    (tool: typeof state.activeTool) => {
      // If switching away from a multi-part draw with accumulated parts, finalize them
      if (
        state.drawingParts &&
        state.drawingParts.length > 0 &&
        tool !== state.activeTool
      ) {
        editor.finishMultiDrawing();
      } else if (
        state.drawingParts?.length === 0 ||
        (state.drawingPartsType && !state.drawingParts)
      ) {
        editor.clearDrawingParts();
      }

      // If switching away from measurement, finish it
      if (
        state.measurementState &&
        tool !== 'measure_distance' &&
        tool !== 'measure_area'
      ) {
        measurement.finishMeasurement();
      }

      // If switching to measurement mode
      if (tool === 'measure_distance') {
        measurement.startMeasurement('distance');
        return;
      }
      if (tool === 'measure_area') {
        measurement.startMeasurement('area');
        return;
      }

      // If switching to continue_drawing, check if we have a valid feature to continue
      if (tool === 'continue_drawing') {
        if (state.selectedFeatureIds.length === 1) {
          const featureId = state.selectedFeatureIds[0];
          const feature = state.features.features.find((f) => f.id === featureId);
          if (feature) {
            if (isLineGeometry(feature)) {
              const coords = getEditableCoords(
                feature,
                state.vertexEditPartIndex ?? null
              );
              if (coords && coords.length > 0) {
                const line = coords[0];
                // Get the selected vertex to determine which end to continue from
                const selectedVertex = getSelectedVertexRef.current?.();
                const vertexIndex = selectedVertex?.vertexIndex ?? line.length - 1;
                const isStart = vertexIndex === 0;
                editor.startContinueDrawing(
                  featureId,
                  state.vertexEditPartIndex ?? null,
                  0,
                  isStart ? 0 : line.length - 1,
                  'line',
                  isStart ? 'prepend' : 'append'
                );
                return;
              }
            } else if (isPolygonGeometry(feature)) {
              const coords = getEditableCoords(
                feature,
                state.vertexEditPartIndex ?? null
              );
              if (coords && coords.length > 0) {
                const selectedVertex = getSelectedVertexRef.current?.();
                const ringIndex = selectedVertex?.ringIndex ?? 0;
                const vertexIndex = selectedVertex?.vertexIndex ?? 0;
                editor.startContinueDrawing(
                  featureId,
                  state.vertexEditPartIndex ?? null,
                  ringIndex,
                  vertexIndex,
                  'polygon',
                  'append'
                );
                return;
              }
            }
          }
        }
      }

      editor.setTool(tool);
    },
    [
      editor,
      measurement,
      state.measurementState,
      state.drawingParts,
      state.drawingPartsType,
      state.activeTool,
      state.vertexEditFeatureId,
      state.vertexEditPartIndex,
      state.features.features,
      state.selectedFeatureIds,
    ]
  );

  // ─── Measurement click listener ───────────────────────────
  useEffect(() => {
    const handleMeasurementClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.lngLat) {
        measurement.addMeasurementPoint(detail.lngLat);
      }
    };

    window.addEventListener('map:measurement-click', handleMeasurementClick);
    return () => {
      window.removeEventListener(
        'map:measurement-click',
        handleMeasurementClick
      );
    };
  }, [measurement]);

  // ─── Coordinate input ─────────────────────────────────────
  const handleCoordinateInput = useCallback(() => {
    setCoordDialogOpen(true);
  }, []);

  const handleCoordinateConfirm = useCallback(
    (lng: number, lat: number, type: 'point' | 'line' | 'polygon') => {
      if (type === 'point') {
        const feature: ParkFeature = {
          id: uuidv4(),
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          properties: {
            type: 'point',
            layer: 'draft',
          },
        };
        editor.addFeature(feature);
        editor.selectFeatures([feature.id]);

        if (mapInstance) {
          mapInstance.flyTo({ center: [lng, lat], zoom: 16 });
        }
      }
      setCoordDialogOpen(false);
      editor.setTool('select');
    },
    [editor, mapInstance]
  );

  // ─── Save handler ─────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const { features } = state.features;
    const parkFeatures = features.filter((f) => f.properties.layer === 'park');
    const draftFeatures = features.filter(
      (f) => f.properties.layer === 'draft'
    );

    // Merge draft polygons/lines into the main park geometry
    // After a merge operation the park feature may have a new UUID,
    // so fall back to the first park-layer polygon if the original ID isn't found.
    const mainPark =
      parkFeatures.find((f) => f.id === parkId) ??
      parkFeatures.find(
        (f) =>
          f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      );
    const draftPolygons = draftFeatures.filter(
      (f) =>
        f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
    );

    // Build merged geometry for the park if there are draft polygons
    let finalGeometry = mainPark?.geometry;
    if (mainPark && draftPolygons.length > 0) {
      const allPolygonCoords: number[][][][] = [];

      if (mainPark.geometry.type === 'Polygon') {
        allPolygonCoords.push(
          (mainPark.geometry as Polygon).coordinates
        );
      } else if (mainPark.geometry.type === 'MultiPolygon') {
        allPolygonCoords.push(
          ...(mainPark.geometry as MultiPolygon).coordinates
        );
      }

      for (const draft of draftPolygons) {
        if (draft.geometry.type === 'Polygon') {
          allPolygonCoords.push(
            (draft.geometry as Polygon).coordinates
          );
        } else if (draft.geometry.type === 'MultiPolygon') {
          allPolygonCoords.push(
            ...(draft.geometry as MultiPolygon).coordinates
          );
        }
      }

      finalGeometry = {
        type: 'MultiPolygon',
        coordinates: allPolygonCoords,
      } as MultiPolygon;
    }

    // Consolidate editor state
    if (mainPark && draftPolygons.length > 0 && finalGeometry) {
      const consolidatedFeatures: ParkFeatureCollection = {
        type: 'FeatureCollection',
        features: features
          .filter((f) => !draftPolygons.some((d) => d.id === f.id))
          .map((f) =>
            f.id === mainPark.id
              ? {
                  ...f,
                  geometry: finalGeometry!,
                  properties: {
                    ...f.properties,
                    type: 'multipolygon' as const,
                  },
                }
              : f
          ),
      };
      editor.loadSaved(consolidatedFeatures);
    } else {
      editor.save();
    }

    // Persist to database
    if (parkId && finalGeometry) {
      try {
        await patchGreenSpace.mutateAsync({ id: parkId, geometry: finalGeometry });
        toast.success('保存しました');
      } catch (err) {
        toast.error('保存に失敗しました', {
          description: err instanceof Error ? err.message : '不明なエラー',
        });
      }
    }
  }, [state.features, parkId, editor, patchGreenSpace]);

  // ─── Cancel handler ────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (editor.isDirty) {
      const confirmed = window.confirm(
        '変更が保存されていません。キャンセルしますか？'
      );
      if (!confirmed) return;
    }
    editor.cancel();
    toast.info('変更を取り消しました');
  }, [editor]);

  // ─── Split handler ────────────────────────────────────────
  const handleSplit = useCallback(() => {
    if (state.selectedFeatureIds.length !== 1) return;
    const targetId = state.selectedFeatureIds[0];
    const target = state.features.features.find((f) => f.id === targetId);
    if (
      !target ||
      (target.geometry.type !== 'Polygon' &&
        target.geometry.type !== 'MultiPolygon')
    ) {
      toast.error('ポリゴンを選択してください');
      return;
    }
    setSplitTargetId(targetId);
    editor.setTool('draw_clip_polygon');
    toast.info('クリップツール', {
      description:
        '切り取る領域をポリゴンで描画してください（ダブルクリックで確定）',
    });
  }, [editor, state.selectedFeatureIds, state.features.features]);

  // ─── Merge check ──────────────────────────────────────────
  const canMerge =
    state.selectedFeatureIds.length >= 2 &&
    (() => {
      const selected = editor.selectedFeatures;
      const allPolygons = selected.every(
        (f) =>
          f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      );
      const allLines = selected.every(
        (f) =>
          f.geometry.type === 'LineString' ||
          f.geometry.type === 'MultiLineString'
      );
      return allPolygons || allLines;
    })();

  // ─── Fly to all features ───────────────────────────────────
  const handleFlyToAll = useCallback(() => {
    if (mapInstance && state.features.features.length > 0) {
      flyToLayer(mapInstance, state.features.features);
    }
  }, [mapInstance, state.features.features]);

  const flyToDisabled = state.features.features.length === 0;

  // ─── Loading state ────────────────────────────────────────
  if (parkQuery.isLoading || facilitiesQuery.isLoading) {
    return (
      <div className="flex h-[calc(100vh-60px)] w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-gray-900 rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────
  if (parkQuery.isError) {
    return (
      <div className="flex h-[calc(100vh-60px)] w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-3">
            データの読み込みに失敗しました
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {parkQuery.error instanceof Error
              ? parkQuery.error.message
              : '不明なエラー'}
          </p>
          <button
            onClick={() => navigate(`/assets/parks/${parkId}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 cursor-pointer"
          >
            <IconArrowLeft size={16} />
            戻る
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-60px)] w-full overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
        {/* Back button + Save/Cancel */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <button
            onClick={() => navigate(`/assets/parks/${parkId}`)}
            className="flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-sm font-medium text-gray-700 shadow-md backdrop-blur-sm hover:bg-white"
          >
            <IconArrowLeft size={16} />
            戻る
          </button>
          <button
            onClick={handleCancel}
            disabled={!editorReady}
            className="rounded-lg bg-white/95 px-3 py-2 text-sm font-medium text-gray-700 shadow-md backdrop-blur-sm hover:bg-white disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!editorReady}
            className="rounded-lg bg-gray-900/95 px-3 py-2 text-sm font-medium text-white shadow-md backdrop-blur-sm hover:bg-gray-900 disabled:opacity-50"
          >
            保存
          </button>
        </div>

        {/* Map */}
        <MapEditor
          features={state.features}
          visibleFeatures={editor.visibleFeatures}
          selectedFeatureIds={state.selectedFeatureIds}
          activeTool={state.activeTool}
          measurementState={state.measurementState}
          snappingEnabled={state.snappingEnabled}
          editor={wrappedEditor}
          onMapReady={setMapInstance}
          splitTargetId={splitTargetId}
          getSelectedVertexRef={getSelectedVertexRef}
          interactionDisabled={!editorReady}
        />


        {/* Status Bar */}
        <StatusBar
          cursorPosition={state.cursorPosition}
          activeTool={state.activeTool}
          liveMeasurement={state.liveMeasurement}
          isDrawing={state.isDrawing}
          featureCount={state.features.features.length}
          selectedCount={state.selectedFeatureIds.length}
          multiDrawPartCount={state.drawingParts?.length ?? 0}
          multiDrawType={state.drawingPartsType}
        />

        {/* Floating Toolbar */}
        <FloatingToolbar
          activeTool={state.activeTool}
          onSetTool={handleSetTool}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          onUndo={editor.undo}
          onRedo={editor.redo}
          hasSelection={state.selectedFeatureIds.length > 0}
          selectionCount={state.selectedFeatureIds.length}
          canMerge={canMerge}
          onDuplicate={editor.duplicateSelected}
          onDelete={editor.deleteSelected}
          onMerge={editor.mergeSelected}
          onSplit={handleSplit}
          snappingEnabled={state.snappingEnabled}
          onToggleSnapping={editor.toggleSnapping}
          onCoordinateInput={handleCoordinateInput}
          onSaveAsMeasurement={measurement.saveAsGeometry}
          isMeasuring={
            !!state.measurementState &&
            state.measurementState.points.length >= 2
          }
          modeConfig={modeConfig}
          featureCount={state.features.features.length}
          onFlyTo={handleFlyToAll}
          flyToDisabled={flyToDisabled}
        />

        {/* Continue drawing actions (floating above toolbar) */}
        {state.continueDrawingState && (
          <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <span className="text-xs text-gray-500">
                {state.continueDrawingState.newVertices.length} 頂点追加済み
              </span>
              <button
                onClick={() => editor.undoContinueVertex()}
                disabled={state.continueDrawingState.newVertices.length === 0}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30"
              >
                元に戻す
              </button>
              <button
                onClick={() => editor.finishContinueDrawing()}
                className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-800"
              >
                確定
              </button>
              <button
                onClick={() => editor.cancelContinueDrawing()}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Multi-draw part count indicator */}
        {state.drawingParts && state.drawingParts.length > 0 && (
          <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <span className="text-xs text-gray-500">
                {state.drawingParts.length} パート描画済み
              </span>
              <button
                onClick={() => editor.finishMultiDrawing()}
                className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-800"
              >
                完了 (Enter)
              </button>
            </div>
          </div>
        )}

        {/* Merge parts indicator */}
        {state.activeTool === 'merge_parts' && (
          <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <span className="text-xs text-gray-500">
                {state.selectedPartIndices.length} パーツ選択中
              </span>
              <button
                onClick={() => {
                  if (state.selectedPartIndices.length >= 2 && state.selectedFeatureIds[0]) {
                    editor.mergeParts(state.selectedFeatureIds[0], state.selectedPartIndices);
                  }
                  editor.setTool('select');
                }}
                disabled={state.selectedPartIndices.length < 2}
                className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-30"
              >
                結合 (Enter)
              </button>
              <button
                onClick={() => editor.setTool('select')}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Coordinate Input Dialog */}
        <CoordinateInputDialog
          open={coordDialogOpen}
          onClose={() => {
            setCoordDialogOpen(false);
            editor.setTool('select');
          }}
          onConfirm={handleCoordinateConfirm}
        />
      </div>
    </div>
  );
}
