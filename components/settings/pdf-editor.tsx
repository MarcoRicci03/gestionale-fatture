"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { AlertTriangle } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { updatePdfSettings } from "@/lib/actions/settings";
import { LAYOUT_DEFAULT, DEFAULT_BLOCCO } from "@/lib/pdf/layout-default";
import { useTextCursorInsert } from "@/lib/hooks/use-text-cursor-insert";
import { usePdfLayoutHistory } from "@/components/settings/use-pdf-layout-history";
import { PRESETS, DEFAULT_MESE_CONFIG } from "@/components/settings/pdf-editor-presets";
import { Block } from "@/components/settings/pdf-editor-block";
import { useCanvasZoomPan } from "@/components/settings/use-canvas-zoom-pan";
import { useBlockDragging } from "@/components/settings/use-block-dragging";
import { usePdfEditorKeyboardShortcuts } from "@/components/settings/use-pdf-editor-keyboard-shortcuts";
import { PdfEditorToolbar } from "@/components/settings/pdf-editor-toolbar";
import { PdfEditorAddBlockPanel } from "@/components/settings/pdf-editor-add-block-panel";
import { PdfEditorPageSettingsPanel } from "@/components/settings/pdf-editor-page-settings-panel";
import { PdfEditorBlockPropertiesPanel } from "@/components/settings/pdf-editor-block-properties-panel";
import { PAGE_W, PAGE_H, clamp } from "@/lib/pdf/canvas-geometry";
import type {
  Blocco,
  ImpostazioniPdf,
  PdfLayout,
  PdfSettingsInput,
  TipoBlocco,
} from "@/lib/pdf/types";

type PdfEditorProps = {
  initialSettings: ImpostazioniPdf;
  userId: number;
};

function makeId() {
  return crypto.randomUUID();
}

export function PdfEditor({ initialSettings, userId }: PdfEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { zoom, setZoom, autoFit, setAutoFit, fitZoom } = useCanvasZoomPan({ canvasRef });
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [advancedMode, setAdvancedMode] = useState(false);

  const onPdfLayoutNavigate = useCallback((nextSettings: ImpostazioniPdf) => {
    setSelectedIds((prev) => {
      const validIds = new Set<string>();
      prev.forEach((id) => {
        if (nextSettings.blocchi.some((b) => b.id === id)) validIds.add(id);
      });
      return validIds;
    });
    setEditingBlockId((cur) =>
      cur && nextSettings.blocchi.some((b) => b.id === cur) ? cur : null
    );
  }, []);

  const { settings, pushSettings, undo, redo, canUndo, canRedo } = usePdfLayoutHistory({
    initialSettings,
    onNavigate: onPdfLayoutNavigate,
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [notification]);

  // Forza un re-render quando cambia la selezione/formattazione dentro
  // l'editor attivo, così i pulsanti Grassetto/Corsivo/Nota possono riflettere
  // lo stato "attivo" corrente (activeEditor.isActive(...)) letto al render.
  const [, setFormatTick] = useState(0);
  useEffect(() => {
    if (!activeEditor) return;
    const bump = () => setFormatTick((t) => t + 1);
    activeEditor.on("selectionUpdate", bump);
    activeEditor.on("transaction", bump);
    return () => {
      activeEditor.off("selectionUpdate", bump);
      activeEditor.off("transaction", bump);
    };
  }, [activeEditor]);

  const [resetOpen, setResetOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [clipboard, setClipboard] = useState<{
    blocks: Blocco[];
    isCut: boolean;
  } | null>(null);
  const pasteCountRef = useRef(0);
  const isMouseOverCanvas = useRef(false);

  const selectedBlock = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const [id] = Array.from(selectedIds);
    return settings.blocchi.find((b) => b.id === id) ?? null;
  }, [settings.blocchi, selectedIds]);

  const updateBlock = useCallback((id: string, patch: Partial<Blocco>) => {
    const roundedPatch = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => {
        if (
          ["x", "y", "width", "height", "fontSize"].includes(key) &&
          typeof value === "number"
        ) {
          return [key, Math.round(value)];
        }
        return [key, value];
      })
    ) as Partial<Blocco>;

    pushSettings((prev) => ({
      ...prev,
      blocchi: prev.blocchi.map((b) =>
        b.id === id ? { ...b, ...roundedPatch } : b
      ),
    }));
  }, [pushSettings]);

  const { dragging, guides, handleDragStart, handleDrag, handleDragStop } = useBlockDragging({
    blocchi: settings.blocchi,
    updateBlock,
    onDragStart: (id) => setSelectedIds(new Set([id])),
  });

  const updateSettings = useCallback(
    (patch: Partial<PdfLayout>) => {
      const roundedPatch = Object.fromEntries(
        Object.entries(patch).map(([key, value]) =>
          typeof value === "number" ? [key, Math.round(value)] : [key, value]
        )
      ) as Partial<PdfLayout>;
      pushSettings((prev) => ({ ...prev, ...roundedPatch }));
    },
    [pushSettings]
  );

  const handleTestoChange = useCallback(
    (next: string) => {
      if (!selectedBlock) return;
      updateBlock(selectedBlock.id, { testo: next });
    },
    [selectedBlock, updateBlock]
  );

  const {
    ref: testoRef,
    insertAtCursor: insertPlaceholder,
    wrapSelection: wrapText,
  } = useTextCursorInsert(selectedBlock?.testo ?? "", handleTestoChange);

  const startEditing = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
    setEditingBlockId(id);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingBlockId(null);
    setActiveEditor(null);
  }, []);

  const insertPlaceholderChip = useCallback(
    (value: string, label: string) => {
      activeEditor?.chain().focus().insertVariable({ placeholder: value, label }).run();
    },
    [activeEditor]
  );

  const toggleRichBold = useCallback(() => {
    activeEditor?.chain().focus().toggleBold().run();
  }, [activeEditor]);

  const toggleRichItalic = useCallback(() => {
    activeEditor?.chain().focus().toggleItalic().run();
  }, [activeEditor]);

  const toggleRichNota = useCallback(() => {
    activeEditor?.chain().focus().toggleNota().run();
  }, [activeEditor]);

  const addBlock = useCallback((tipo: TipoBlocco) => {
    const preset = PRESETS[tipo];
    const id = makeId();
    pushSettings((prev) => {
      const count = prev.blocchi.filter((b) => b.tipo === tipo).length;
      const newBlock: Blocco = {
        id,
        tipo,
        x: 40 + count * 10,
        y: 120 + count * 20,
        width: DEFAULT_BLOCCO.width,
        height: DEFAULT_BLOCCO.height,
        fontSize: DEFAULT_BLOCCO.fontSize,
        align: DEFAULT_BLOCCO.align,
        visible: true,
        ...(tipo === "mesi"
          ? { meseConfig: { ...DEFAULT_MESE_CONFIG } }
          : { testo: preset.defaultText }),
      };
      return { ...prev, blocchi: [...prev.blocchi, newBlock] };
    });
    setSelectedIds(new Set([id]));
  }, [pushSettings]);

  const removeBlock = useCallback((id: string) => {
    pushSettings((prev) => ({
      ...prev,
      blocchi: prev.blocchi.filter((b) => b.id !== id),
    }));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setEditingBlockId((cur) => (cur === id ? null : cur));
  }, [pushSettings]);

  usePdfEditorKeyboardShortcuts({
    blocchi: settings.blocchi,
    selectedIds,
    setSelectedIds,
    clipboard,
    setClipboard,
    pasteCountRef,
    isMouseOverCanvas,
    removeBlock,
    undo,
    redo,
    pushSettings,
    setAutoFit,
    setZoom,
  });

  const duplicateBlock = useCallback((id: string) => {
    const block = settings.blocchi.find((b) => b.id === id);
    if (!block) return;
    const newBlock: Blocco = {
      ...block,
      id: makeId(),
      x: clamp(block.x + 10, 0, PAGE_W - block.width),
      y: clamp(block.y + 10, 0, PAGE_H - block.height),
    };
    pushSettings((prev) => ({
      ...prev,
      blocchi: [...prev.blocchi, newBlock],
    }));
    setSelectedIds(new Set([newBlock.id]));
  }, [settings.blocchi, pushSettings]);

  const moveOrder = useCallback((id: string, direction: -1 | 1) => {
    pushSettings((prev) => {
      const idx = prev.blocchi.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const newIdx = clamp(idx + direction, 0, prev.blocchi.length - 1);
      if (newIdx === idx) return prev;
      const next = [...prev.blocchi];
      const [removed] = next.splice(idx, 1);
      next.splice(newIdx, 0, removed);
      return { ...prev, blocchi: next };
    });
  }, [pushSettings]);

  const handleSave = useCallback(() => {
    setNotification(null);

    const input: PdfSettingsInput = {
      pageWidth: settings.pageWidth,
      pageHeight: settings.pageHeight,
      marginTop: settings.marginTop,
      marginRight: settings.marginRight,
      marginBottom: settings.marginBottom,
      marginLeft: settings.marginLeft,
      fontFamily: settings.fontFamily,
      fontSizeBase: settings.fontSizeBase,
      blocchi: settings.blocchi,
    };

    startTransition(async () => {
      const result = await updatePdfSettings(input);
      if (result.success) {
        setNotification({ message: "Impostazioni salvate con successo", type: "success" });
      } else {
        setNotification({ message: result.error, type: "error" });
      }
    });
  }, [settings]);

  const handleReset = useCallback(() => {
    const now = new Date();
    pushSettings({
      ...LAYOUT_DEFAULT,
      id: settings.id,
      id_Utente: userId,
      createdAt: now,
      updatedAt: now,
    });
    setSelectedIds(new Set());
    stopEditing();
    setResetOpen(false);
  }, [settings.id, userId, pushSettings, stopEditing]);

  return (
    <div className="relative flex flex-col gap-4">
      <PdfEditorToolbar
        zoom={zoom}
        autoFit={autoFit}
        showGrid={showGrid}
        previewMode={previewMode}
        canUndo={canUndo}
        canRedo={canRedo}
        isSaving={isPending}
        onFitToWindow={() => {
          setAutoFit(true);
          fitZoom();
        }}
        onZoomOut={() => {
          setAutoFit(false);
          setZoom((z) => clamp(z - 0.1, 0.3, 1.5));
        }}
        onZoomIn={() => {
          setAutoFit(false);
          setZoom((z) => clamp(z + 0.1, 0.3, 1.5));
        }}
        onToggleGrid={() => setShowGrid((v) => !v)}
        onTogglePreview={() => {
          setPreviewMode((v) => !v);
          setSelectedIds(new Set());
          stopEditing();
        }}
        onUndo={undo}
        onRedo={redo}
        onOpenReset={() => setResetOpen(true)}
        onSave={handleSave}
      />

      {notification && (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg transition-opacity duration-300",
            notification.type === "error"
              ? "bg-destructive text-destructive-foreground"
              : "bg-green-600 text-white"
          )}
        >
          {notification.message}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-amber-600/30 bg-amber-600/10 px-4 py-3 text-sm text-amber-800 lg:hidden dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          L&apos;editor del layout è ottimizzato per schermi grandi. Per una
          modifica precisa, usa un tablet in orizzontale o un computer.
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:h-[calc(100vh-340px)] lg:flex-row lg:items-start">
        {/* Toolbar sinistra */}
        <PdfEditorAddBlockPanel previewMode={previewMode} onAddBlock={addBlock} />

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="order-1 flex h-[70vh] flex-1 cursor-grab justify-center overflow-auto rounded-lg border bg-muted/20 p-4 active:cursor-grabbing lg:order-2 lg:h-[calc(100vh-340px)]"
          onMouseEnter={() => {
            isMouseOverCanvas.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverCanvas.current = false;
          }}
        >
          <div
            className="light relative bg-white shadow-sm"
            style={{
              width: PAGE_W,
              height: PAGE_H,
              zoom,
              flexShrink: 0,
            }}
            onPointerDown={(e) => {
              if (e.target !== e.currentTarget) return;
              setSelectedIds(new Set());
              stopEditing();
            }}
          >
            {showGrid && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
            )}

            {!previewMode && (
              <div
                className="pointer-events-none absolute border border-dashed border-primary/30"
                style={{
                  left: settings.marginLeft,
                  top: settings.marginTop,
                  right: settings.marginRight,
                  bottom: settings.marginBottom,
                }}
              />
            )}

            {settings.blocchi.map((blocco) => (
              <Block
                key={blocco.id}
                blocco={blocco}
                isSelected={selectedIds.has(blocco.id)}
                isEditing={editingBlockId === blocco.id}
                isPreview={previewMode}
                zoom={zoom}
                dragPosition={
                  dragging?.id === blocco.id
                    ? { x: dragging.x, y: dragging.y }
                    : undefined
                }
                onSelect={() => {
                  setSelectedIds(new Set([blocco.id]));
                  setEditingBlockId((cur) => (cur === blocco.id ? cur : null));
                }}
                onStartEditing={() => startEditing(blocco.id)}
                onExitEditing={stopEditing}
                onEditorReady={(editor) => {
                  if (editingBlockId === blocco.id) setActiveEditor(editor);
                }}
                onDragStart={() => handleDragStart(blocco.id)}
                onDrag={(_e, d) => handleDrag(blocco.id, d.x, d.y)}
                onDragStop={() => handleDragStop(blocco.id)}
                onUpdate={(patch) => updateBlock(blocco.id, patch)}
              />
            ))}

            {guides.x != null && (
              <div
                className="pointer-events-none absolute z-50 bg-primary"
                style={{
                  left: guides.x,
                  top: 0,
                  width: 1,
                  height: PAGE_H,
                  opacity: 0.6,
                }}
              />
            )}
            {guides.y != null && (
              <div
                className="pointer-events-none absolute z-50 bg-primary"
                style={{
                  left: 0,
                  top: guides.y,
                  width: PAGE_W,
                  height: 1,
                  opacity: 0.6,
                }}
              />
            )}
          </div>
        </div>

        {/* Pannello proprietà */}
        <div className="order-3 flex w-full flex-col gap-3 lg:w-72 lg:max-h-full lg:overflow-auto">
          {!previewMode && (
            <PdfEditorPageSettingsPanel
              open={pageSettingsOpen}
              onToggleOpen={() => setPageSettingsOpen((v) => !v)}
              marginTop={settings.marginTop}
              marginRight={settings.marginRight}
              marginBottom={settings.marginBottom}
              marginLeft={settings.marginLeft}
              onChangeMargins={updateSettings}
            />
          )}
          {selectedBlock && !previewMode ? (
            <PdfEditorBlockPropertiesPanel
              selectedBlock={selectedBlock}
              advancedMode={advancedMode}
              onToggleAdvancedMode={() => setAdvancedMode((v) => !v)}
              activeEditor={activeEditor}
              testoRef={testoRef}
              wrapText={wrapText}
              insertPlaceholder={insertPlaceholder}
              insertPlaceholderChip={insertPlaceholderChip}
              toggleRichBold={toggleRichBold}
              toggleRichItalic={toggleRichItalic}
              toggleRichNota={toggleRichNota}
              updateBlock={updateBlock}
              moveOrder={moveOrder}
              duplicateBlock={duplicateBlock}
              removeBlock={removeBlock}
            />
          ) : (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              {previewMode
                ? "Modalità anteprima: il layout viene mostrato con dati di esempio."
                : selectedIds.size > 1
                  ? `${selectedIds.size} blocchi selezionati`
                  : "Seleziona un blocco sul foglio per modificarne le proprietà."}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Ripristina layout di default"
        description="Tutte le personalizzazioni andranno perse. Sei sicuro?"
        confirmLabel="Ripristina"
        onConfirm={handleReset}
      />
    </div>
  );
}
