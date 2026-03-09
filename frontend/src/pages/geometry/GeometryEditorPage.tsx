import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Map as MaplibreMap } from "maplibre-gl";

import { MapEditor } from "@/features/geometry-editor/components/map-editor";
import { FloatingToolbar } from "@/features/geometry-editor/components/floating-toolbar";
import { StatusBar } from "@/features/geometry-editor/components/status-bar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

import { useEditorState } from "@/features/geometry-editor/hooks/use-editor-state";
import { useMeasurement } from "@/features/geometry-editor/hooks/use-measurement";
import { MOCK_FEATURES } from "@/features/geometry-editor/mock-data";
import { loadFeatures, saveFeatures } from "@/features/geometry-editor/lib/storage";
import { flyToLayer } from "@/features/geometry-editor/lib/camera";
import { getEditorModeConfig } from "@/features/geometry-editor/editor-mode-config";

/**
 * Standalone Geometry Editor page (park mode).
 *
 * Shows only the map, floating toolbar, and status bar.
 * No header, sidebar, layer panel, or properties panel.
 */
export default function GeometryEditorPage() {
  const modeConfig = useMemo(() => getEditorModeConfig("park"), []);

  const editor = useEditorState(MOCK_FEATURES);
  const { state } = editor;

  const [mapInstance, setMapInstance] = useState<MaplibreMap | null>(null);
  const [splitTargetId, setSplitTargetId] = useState<string | null>(null);

  const getSelectedVertexRef = useRef<(() => { ringIndex: number; vertexIndex: number } | null) | null>(null);

  // Load saved features from localStorage
  useEffect(() => {
    const saved = loadFeatures();
    if (saved) {
      editor.loadSaved(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear clip target when leaving clip mode
  useEffect(() => {
    if (state.activeTool !== "draw_clip_polygon") {
      setSplitTargetId(null);
    }
  }, [state.activeTool]);

  // Measurement hook
  const measurement = useMeasurement({
    measurementState: state.measurementState,
    setMeasurementState: editor.setMeasurementState,
    setLiveMeasurement: editor.setLiveMeasurement,
    addFeature: editor.addFeature,
  });

  // Handle tool changes
  const handleSetTool = useCallback(
    (tool: typeof state.activeTool) => {
      if (!modeConfig.allowedTools.includes(tool)) return;

      if (
        state.drawingParts &&
        state.drawingParts.length > 0 &&
        tool !== state.activeTool
      ) {
        editor.finishMultiDrawing();
      } else if (state.drawingParts?.length === 0 || (state.drawingPartsType && !state.drawingParts)) {
        editor.clearDrawingParts();
      }

      if (
        state.measurementState &&
        tool !== "measure_distance" &&
        tool !== "measure_area"
      ) {
        measurement.finishMeasurement();
      }

      if (tool !== "draw_clip_polygon") {
        setSplitTargetId(null);
      }

      if (tool === "measure_distance") {
        measurement.startMeasurement("distance");
      } else if (tool === "measure_area") {
        measurement.startMeasurement("area");
      }

      editor.setTool(tool);
    },
    [editor, measurement, modeConfig, state.measurementState, state.drawingParts, state.drawingPartsType, state.activeTool]
  );

  // Measurement click listener
  useEffect(() => {
    const handleMeasurementClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.lngLat) {
        measurement.addMeasurementPoint(detail.lngLat);
      }
    };

    window.addEventListener("map:measurement-click", handleMeasurementClick);
    return () => {
      window.removeEventListener("map:measurement-click", handleMeasurementClick);
    };
  }, [measurement]);

  // Save / Cancel
  const saveValidation = useMemo(
    () => modeConfig.validateOnSave(state.features.features),
    [modeConfig, state.features.features]
  );
  const isSaveDisabled = !saveValidation.valid;

  const handleSave = useCallback(() => {
    const validation = modeConfig.validateOnSave(state.features.features);
    if (!validation.valid) {
      toast.error("保存できません", { description: validation.message });
      return;
    }
    editor.save();
    saveFeatures(state.features);
    toast.success("保存しました", {
      description: `${state.features.features.length} 件のフィーチャーを保存しました`,
    });
  }, [editor, state.features, modeConfig]);

  const handleCancel = useCallback(() => {
    if (editor.isDirty) {
      const confirmed = window.confirm("変更が保存されていません。キャンセルしますか？");
      if (!confirmed) return;
    }
    editor.cancel();
    toast.info("変更を取り消しました");
  }, [editor]);

  // Fly to features
  const handleFlyToAll = useCallback(() => {
    if (mapInstance && state.features.features.length > 0) {
      flyToLayer(mapInstance, state.features.features);
    }
  }, [mapInstance, state.features.features]);

  const flyToDisabled = state.features.features.length === 0;

  // Split handler
  const handleSplit = useCallback(() => {
    if (state.selectedFeatureIds.length !== 1) return;
    const targetId = state.selectedFeatureIds[0];
    const target = state.features.features.find((f) => f.id === targetId);
    if (!target || (target.geometry.type !== "Polygon" && target.geometry.type !== "MultiPolygon")) {
      toast.error("ポリゴンを選択してください");
      return;
    }
    setSplitTargetId(targetId);
    editor.setTool("draw_clip_polygon");
    toast.info("クリップツール", {
      description: "切り取る領域をポリゴンで描画してください（ダブルクリックで確定）",
    });
  }, [editor, state.selectedFeatureIds, state.features.features]);

  // Merge check
  const canMerge =
    state.selectedFeatureIds.length >= 2 &&
    (() => {
      const selected = editor.selectedFeatures;
      const allPolygons = selected.every(
        (f) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
      );
      const allLines = selected.every(
        (f) => f.geometry.type === "LineString" || f.geometry.type === "MultiLineString"
      );
      return allPolygons || allLines;
    })();

  const handleMerge = useCallback(() => {
    editor.mergeSelected();
  }, [editor]);

  // Merge parts confirm (park mode)
  const handleMergePartsConfirm = useCallback(() => {
    if (state.selectedPartIndices.length >= 2 && state.selectedFeatureIds.length === 1) {
      editor.mergeParts(state.selectedFeatureIds[0], state.selectedPartIndices);
    }
    editor.setTool("select");
  }, [editor, state.selectedFeatureIds, state.selectedPartIndices]);

  const handleMergePartsCancel = useCallback(() => {
    editor.setTool("select");
  }, [editor]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative h-full w-full overflow-hidden">
        {/* Map */}
        <MapEditor
          features={state.features}
          visibleFeatures={editor.visibleFeatures}
          selectedFeatureIds={state.selectedFeatureIds}
          activeTool={state.activeTool}
          measurementState={state.measurementState}
          snappingEnabled={state.snappingEnabled}
          editor={editor}
          onMapReady={setMapInstance}
          splitTargetId={splitTargetId}
          getSelectedVertexRef={getSelectedVertexRef}
          allowedTools={modeConfig.allowedTools}
          editorMode="park"
          onFlyTo={modeConfig.showFlyTo && !flyToDisabled ? handleFlyToAll : undefined}
        />

        {/* Floating Save/Cancel (top-right) */}
        <div className="absolute top-3 right-3 z-20">
          <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              キャンセル
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                {isSaveDisabled ? (
                  <span className="inline-flex" tabIndex={0}>
                    <Button
                      size="sm"
                      disabled
                      className="bg-park text-park-foreground hover:bg-park/90"
                    >
                      保存
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSave}
                    className="bg-park text-park-foreground hover:bg-park/90"
                  >
                    保存
                  </Button>
                )}
              </TooltipTrigger>
              {isSaveDisabled && saveValidation.message && (
                <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                  {saveValidation.message}
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>

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
          selectedPartCount={state.selectedPartIndices.length}
          totalPartCount={
            state.selectedFeatureIds.length === 1
              ? (() => {
                  const f = state.features.features.find((feat) => feat.id === state.selectedFeatureIds[0]);
                  return f?.geometry.type === "MultiPolygon"
                    ? (f.geometry as import("geojson").MultiPolygon).coordinates.length
                    : 0;
                })()
              : 0
          }
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
          onMerge={handleMerge}
          onSplit={handleSplit}
          snappingEnabled={state.snappingEnabled}
          onToggleSnapping={editor.toggleSnapping}
          onCoordinateInput={() => {}}
          onSaveAsMeasurement={measurement.saveAsGeometry}
          isMeasuring={!!state.measurementState && state.measurementState.points.length >= 2}
          modeConfig={modeConfig}
          featureCount={state.features.features.length}
          onFlyTo={handleFlyToAll}
          flyToDisabled={flyToDisabled}
        />

        {/* Continue drawing actions */}
        {state.continueDrawingState && (
          <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <span className="text-xs font-medium text-amber-600">
                描画延長中{state.continueDrawingState.newVertices.length > 0
                  ? ` (${state.continueDrawingState.newVertices.length} 頂点)`
                  : ""}
              </span>
              <div className="h-4 w-px bg-border" />
              <button
                onClick={editor.cancelContinueDrawing}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                キャンセル
                <kbd className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                  Esc
                </kbd>
              </button>
              <button
                onClick={() => editor.finishContinueDrawing("free", null, null)}
                disabled={state.continueDrawingState.newVertices.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-500/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                確定
                <kbd className="ml-1 rounded bg-white/20 px-1 py-0.5 text-[10px] font-mono">
                  Enter
                </kbd>
              </button>
            </div>
          </div>
        )}

        {/* Multi-draw actions */}
        {state.drawingParts && state.drawingParts.length > 0 && (
          <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 rounded-xl border border-park/30 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {state.drawingParts.length} パート
              </span>
              <div className="h-4 w-px bg-border" />
              <button
                onClick={() => {
                  editor.clearDrawingParts();
                  editor.setTool("select");
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                キャンセル
              </button>
              <button
                onClick={editor.finishMultiDrawing}
                className="flex items-center gap-1.5 rounded-lg bg-park px-3 py-1.5 text-xs font-medium text-park-foreground transition-colors hover:bg-park/90"
              >
                完了
                <kbd className="ml-1 rounded bg-park-foreground/20 px-1 py-0.5 text-[10px] font-mono">
                  Enter
                </kbd>
              </button>
            </div>
          </div>
        )}

        {/* Merge parts actions */}
        {state.activeTool === "merge_parts" && (
          <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 rounded-xl border border-park/30 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {state.selectedPartIndices.length} パート
              </span>
              <div className="h-4 w-px bg-border" />
              <button
                onClick={handleMergePartsCancel}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                キャンセル
              </button>
              <button
                onClick={handleMergePartsConfirm}
                disabled={state.selectedPartIndices.length < 2}
                className="flex items-center gap-1.5 rounded-lg bg-park px-3 py-1.5 text-xs font-medium text-park-foreground transition-colors hover:bg-park/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                完了
                <kbd className="ml-1 rounded bg-park-foreground/20 px-1 py-0.5 text-[10px] font-mono">
                  Enter
                </kbd>
              </button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
