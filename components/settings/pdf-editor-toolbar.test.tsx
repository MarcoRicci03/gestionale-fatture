import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PdfEditorToolbar } from "./pdf-editor-toolbar";

function renderToolbar(overrides: Partial<Parameters<typeof PdfEditorToolbar>[0]> = {}) {
  return render(
    <PdfEditorToolbar
      zoom={0.55}
      autoFit={true}
      showGrid={false}
      previewMode={false}
      canUndo={false}
      canRedo={false}
      isSaving={false}
      onFitToWindow={vi.fn()}
      onZoomOut={vi.fn()}
      onZoomIn={vi.fn()}
      onToggleGrid={vi.fn()}
      onTogglePreview={vi.fn()}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onOpenReset={vi.fn()}
      onSave={vi.fn()}
      {...overrides}
    />
  );
}

describe("PdfEditorToolbar", () => {
  it("mostra la percentuale di zoom arrotondata", () => {
    renderToolbar({ zoom: 0.552 });
    expect(screen.getByText("55%")).toBeInTheDocument();
  });

  it("disabilita Annulla/Ripeti quando canUndo/canRedo sono false", () => {
    renderToolbar({ canUndo: false, canRedo: false });
    expect(screen.getByTitle("Annulla")).toBeDisabled();
    expect(screen.getByTitle("Ripeti")).toBeDisabled();
  });

  it("abilita Annulla/Ripeti quando canUndo/canRedo sono true", () => {
    renderToolbar({ canUndo: true, canRedo: true });
    expect(screen.getByTitle("Annulla")).toBeEnabled();
    expect(screen.getByTitle("Ripeti")).toBeEnabled();
  });

  it("chiama onUndo/onRedo al click", async () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const user = userEvent.setup();
    renderToolbar({ canUndo: true, canRedo: true, onUndo, onRedo });
    await user.click(screen.getByTitle("Annulla"));
    await user.click(screen.getByTitle("Ripeti"));
    expect(onUndo).toHaveBeenCalled();
    expect(onRedo).toHaveBeenCalled();
  });

  it("mostra 'Salvataggio...' quando isSaving è true", () => {
    renderToolbar({ isSaving: true });
    expect(screen.getByText("Salvataggio...")).toBeInTheDocument();
  });

  it("mostra 'Anteprima'/'Modifica' a seconda di previewMode e chiama onTogglePreview", async () => {
    const onTogglePreview = vi.fn();
    const user = userEvent.setup();
    const { rerender } = renderToolbar({ previewMode: false, onTogglePreview });
    await user.click(screen.getByText("Anteprima"));
    expect(onTogglePreview).toHaveBeenCalled();
    rerender(
      <PdfEditorToolbar
        zoom={0.55}
        autoFit={true}
        showGrid={false}
        previewMode={true}
        canUndo={false}
        canRedo={false}
        isSaving={false}
        onFitToWindow={vi.fn()}
        onZoomOut={vi.fn()}
        onZoomIn={vi.fn()}
        onToggleGrid={vi.fn()}
        onTogglePreview={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onOpenReset={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("Modifica")).toBeInTheDocument();
  });

  it("chiama onOpenReset e onSave al click sui rispettivi pulsanti", async () => {
    const onOpenReset = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup();
    renderToolbar({ onOpenReset, onSave });
    await user.click(screen.getByText("Reset"));
    await user.click(screen.getByText("Salva modifiche"));
    expect(onOpenReset).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });
});
