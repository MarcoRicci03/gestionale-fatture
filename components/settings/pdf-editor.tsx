"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bold,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Italic,
  Trash2,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { updatePdfSettings } from "@/lib/actions/settings";
import { LAYOUT_DEFAULT, DEFAULT_BLOCCO } from "@/lib/pdf/layout-default";
import { useTextCursorInsert } from "@/lib/hooks/use-text-cursor-insert";
import { PLACEHOLDER_GROUPS } from "@/lib/pdf/placeholder-catalog";
import { PdfEditorMesiPanel } from "@/components/settings/pdf-editor-mesi-panel";
import { usePdfLayoutHistory } from "@/components/settings/use-pdf-layout-history";
import { PRESETS, DEFAULT_MESE_CONFIG } from "@/components/settings/pdf-editor-presets";
import { Block } from "@/components/settings/pdf-editor-block";
import { useCanvasZoomPan } from "@/components/settings/use-canvas-zoom-pan";
import { useBlockDragging } from "@/components/settings/use-block-dragging";
import { usePdfEditorKeyboardShortcuts } from "@/components/settings/use-pdf-editor-keyboard-shortcuts";
import { PdfEditorToolbar } from "@/components/settings/pdf-editor-toolbar";
import { PdfEditorAddBlockPanel } from "@/components/settings/pdf-editor-add-block-panel";
import { PdfEditorPageSettingsPanel } from "@/components/settings/pdf-editor-page-settings-panel";
import {
  PAGE_W,
  PAGE_H,
  clamp,
  toNumber,
} from "@/lib/pdf/canvas-geometry";
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
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">
                  {PRESETS[selectedBlock.tipo].label}
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveOrder(selectedBlock.id, -1)}
                    title="Porta avanti"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveOrder(selectedBlock.id, 1)}
                    title="Porta indietro"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => duplicateBlock(selectedBlock.id)}
                    title="Duplica"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      updateBlock(selectedBlock.id, {
                        visible: !selectedBlock.visible,
                      })
                    }
                    title={selectedBlock.visible ? "Nascondi" : "Mostra"}
                  >
                    {selectedBlock.visible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeBlock(selectedBlock.id)}
                    title="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedBlock.tipo === "mesi" ? (
                <PdfEditorMesiPanel
                  meseConfig={selectedBlock.meseConfig ?? DEFAULT_MESE_CONFIG}
                  onChange={(patch) =>
                    updateBlock(selectedBlock.id, {
                      meseConfig: {
                        ...(selectedBlock.meseConfig ?? DEFAULT_MESE_CONFIG),
                        ...patch,
                      },
                    })
                  }
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Contenuto</Label>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setAdvancedMode((v) => !v)}
                    >
                      <Code2 className="h-3 w-3" />
                      {advancedMode ? "Modalità semplice" : "Modalità avanzata"}
                    </button>
                  </div>

                  {advancedMode ? (
                    <>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => wrapText("<b>", "</b>")}
                          title="Grassetto"
                        >
                          <Bold className="mr-1 h-3.5 w-3.5" />
                          Grassetto
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => wrapText("<i>", "</i>")}
                          title="Corsivo"
                        >
                          <Italic className="mr-1 h-3.5 w-3.5" />
                          Corsivo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => wrapText("<note>", "</note>")}
                          title="Nota grigia"
                        >
                          Nota
                        </Button>
                      </div>
                      <Textarea
                        ref={testoRef}
                        id="testo"
                        rows={5}
                        value={selectedBlock.testo ?? ""}
                        onChange={(e) =>
                          updateBlock(selectedBlock.id, {
                            testo: e.target.value,
                            richContent: undefined,
                          })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant={activeEditor?.isActive("bold") ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={!activeEditor}
                          onClick={toggleRichBold}
                          title="Grassetto"
                        >
                          <Bold className="mr-1 h-3.5 w-3.5" />
                          Grassetto
                        </Button>
                        <Button
                          variant={activeEditor?.isActive("italic") ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={!activeEditor}
                          onClick={toggleRichItalic}
                          title="Corsivo"
                        >
                          <Italic className="mr-1 h-3.5 w-3.5" />
                          Corsivo
                        </Button>
                        <Button
                          variant={activeEditor?.isActive("nota") ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={!activeEditor}
                          onClick={toggleRichNota}
                          title="Nota grigia"
                        >
                          Nota
                        </Button>
                      </div>
                      {!activeEditor && (
                        <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                          Fai doppio clic sul blocco nel foglio per modificarne il testo.
                        </p>
                      )}
                    </>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Inserisci valore dinamico
                    </p>
                    <div className="space-y-2">
                      {PLACEHOLDER_GROUPS.map((group) => (
                        <div key={group.label}>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            {group.label}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {group.items.map((item) => (
                              <Button
                                key={item.value}
                                variant="secondary"
                                size="sm"
                                className="h-6 text-xs"
                                disabled={!advancedMode && !activeEditor}
                                onClick={() =>
                                  advancedMode
                                    ? insertPlaceholder(item.value)
                                    : insertPlaceholderChip(item.value, item.label)
                                }
                              >
                                {item.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="x">X</Label>
                  <Input
                    id="x"
                    type="number"
                    min={0}
                    max={PAGE_W}
                    value={selectedBlock.x}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, {
                        x: clamp(toNumber(e.target.value), 0, PAGE_W),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="y">Y</Label>
                  <Input
                    id="y"
                    type="number"
                    min={0}
                    max={PAGE_H}
                    value={selectedBlock.y}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, {
                        y: clamp(toNumber(e.target.value), 0, PAGE_H),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="w">Larghezza</Label>
                  <Input
                    id="w"
                    type="number"
                    min={10}
                    max={PAGE_W}
                    value={selectedBlock.width}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, {
                        width: clamp(toNumber(e.target.value), 10, PAGE_W),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="h">Altezza</Label>
                  <Input
                    id="h"
                    type="number"
                    min={10}
                    max={PAGE_H}
                    value={selectedBlock.height}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, {
                        height: clamp(toNumber(e.target.value), 10, PAGE_H),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontSize">Dimensione font</Label>
                <Input
                  id="fontSize"
                  type="number"
                  min={6}
                  max={72}
                  value={selectedBlock.fontSize}
                  onChange={(e) =>
                    updateBlock(selectedBlock.id, {
                      fontSize: clamp(toNumber(e.target.value), 6, 72),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Padding blocco</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="paddingTop" className="text-xs text-muted-foreground">Alto</Label>
                    <Input
                      id="paddingTop"
                      type="number"
                      min={0}
                      max={100}
                      value={selectedBlock.paddingTop ?? 0}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, {
                          paddingTop: clamp(toNumber(e.target.value), 0, 100),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="paddingRight" className="text-xs text-muted-foreground">Destra</Label>
                    <Input
                      id="paddingRight"
                      type="number"
                      min={0}
                      max={100}
                      value={selectedBlock.paddingRight ?? 0}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, {
                          paddingRight: clamp(toNumber(e.target.value), 0, 100),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="paddingBottom" className="text-xs text-muted-foreground">Basso</Label>
                    <Input
                      id="paddingBottom"
                      type="number"
                      min={0}
                      max={100}
                      value={selectedBlock.paddingBottom ?? 0}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, {
                          paddingBottom: clamp(toNumber(e.target.value), 0, 100),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="paddingLeft" className="text-xs text-muted-foreground">Sinistra</Label>
                    <Input
                      id="paddingLeft"
                      type="number"
                      min={0}
                      max={100}
                      value={selectedBlock.paddingLeft ?? 0}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, {
                          paddingLeft: clamp(toNumber(e.target.value), 0, 100),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="align">Allineamento</Label>
                <Select
                  value={selectedBlock.align}
                  onValueChange={(v) =>
                    updateBlock(selectedBlock.id, {
                      align: v as Blocco["align"],
                    })
                  }
                >
                  <SelectTrigger id="align" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Sinistra</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="right">Destra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
