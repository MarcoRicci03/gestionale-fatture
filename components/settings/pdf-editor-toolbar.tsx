"use client";

import { Eye, Grid3x3, Maximize, Minus, Plus, Redo2, RefreshCcw, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type PdfEditorToolbarProps = {
  zoom: number;
  autoFit: boolean;
  showGrid: boolean;
  previewMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  onFitToWindow: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onToggleGrid: () => void;
  onTogglePreview: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenReset: () => void;
  onSave: () => void;
};

export function PdfEditorToolbar({
  zoom,
  autoFit,
  showGrid,
  previewMode,
  canUndo,
  canRedo,
  isSaving,
  onFitToWindow,
  onZoomOut,
  onZoomIn,
  onToggleGrid,
  onTogglePreview,
  onUndo,
  onRedo,
  onOpenReset,
  onSave,
}: PdfEditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Button
          variant={autoFit ? "secondary" : "outline"}
          size="sm"
          onClick={onFitToWindow}
          title="Adatta alla finestra"
        >
          <Maximize className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onZoomOut}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-[4rem] text-center text-sm font-medium">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="outline" size="sm" onClick={onZoomIn}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant={showGrid ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleGrid}
        >
          <Grid3x3 className="h-4 w-4" />
        </Button>
        <Button
          variant={previewMode ? "secondary" : "outline"}
          size="sm"
          onClick={onTogglePreview}
        >
          <Eye className="mr-1 h-4 w-4" />
          {previewMode ? "Modifica" : "Anteprima"}
        </Button>
        <Button variant="outline" size="sm" onClick={onUndo} disabled={!canUndo} title="Annulla">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onRedo} disabled={!canRedo} title="Ripeti">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOpenReset}>
          <RefreshCcw className="mr-1 h-4 w-4" />
          Reset
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          <Save className="mr-1 h-4 w-4" />
          {isSaving ? "Salvataggio..." : "Salva modifiche"}
        </Button>
      </div>
    </div>
  );
}
