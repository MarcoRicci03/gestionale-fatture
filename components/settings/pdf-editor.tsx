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
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Grid3x3,
  Italic,
  Maximize,
  Minus,
  Plus,
  Redo2,
  RefreshCcw,
  Save,
  Trash2,
  Type,
  Undo2,
  User,
  UserCircle,
  Users,
  Wallet,
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
import {
  buildMockInvoice,
  resolvePlaceholders,
  renderMesiRows,
} from "@/lib/pdf/placeholders";
import { parseInlineFormatting } from "@/lib/pdf/formatting";
import { useTextCursorInsert } from "@/lib/hooks/use-text-cursor-insert";
import { PLACEHOLDER_GROUPS } from "@/lib/pdf/placeholder-catalog";
import { parseTestoToRichContent } from "@/lib/pdf/rich-text";
import { RichTextBlockEditor } from "@/components/settings/pdf-editor-rich-block";
import { VariableChipBadge } from "@/components/settings/pdf-editor-rich-extensions";
import { PdfEditorMesiPanel } from "@/components/settings/pdf-editor-mesi-panel";
import { usePdfLayoutHistory } from "@/components/settings/use-pdf-layout-history";
import {
  PAGE_W,
  PAGE_H,
  clamp,
  toNumber,
  computeSnap,
  type GuideLines,
} from "@/lib/pdf/canvas-geometry";
import type {
  Blocco,
  ImpostazioniPdf,
  MeseConfig,
  PdfLayout,
  PdfSettingsInput,
  TipoBlocco,
} from "@/lib/pdf/types";

type PdfEditorProps = {
  initialSettings: ImpostazioniPdf;
  userId: number;
};

type DraggingState = { id: string; x: number; y: number };

const DEFAULT_MESE_CONFIG: MeseConfig = {
  titolo: "Dettaglio mesi",
  descrizioneTemplate: "{{riga.meseLabel}}",
  valoreTemplate: "{{riga.prezzo}}",
  mostraTotale: true,
  totaleLabel: "Totale",
};

const PRESETS: Record<
  TipoBlocco,
  { label: string; icon: React.ElementType; defaultText?: string }
> = {
  mittente: {
    label: "Mittente",
    icon: UserCircle,
    defaultText:
      "Mittente\n{{mittente.titoloNomeCognomeSpec}}\n{{mittente.via}}\n{{mittente.cittaProvincia}}\nCF: {{mittente.cf}}\nP.IVA: {{mittente.pIva}}",
  },
  intestatario: {
    label: "Intestatario",
    icon: User,
    defaultText:
      "Intestatario fattura (Pagante)\n{{intestatario.cognomeNome}}\n{{intestatario.via}}\n{{intestatario.capCitta}}\nCF: {{intestatario.cf}}\nP.IVA: {{intestatario.piva}}",
  },
  paziente: {
    label: "Paziente",
    icon: Users,
    defaultText: "Paziente\n{{paziente.cognomeNome}}",
  },
  pagamento: {
    label: "Pagamento",
    icon: Wallet,
    defaultText:
      "Dettagli pagamento\nImporto totale:\t{{fattura.prezzoTotale}}\nModalità:\t{{fattura.modalitaPagamento}}\nN. sedute:\t{{fattura.sedute}}\nNote:\t{{fattura.commento}}",
  },
  testo: {
    label: "Testo libero",
    icon: Type,
    defaultText: "Testo libero",
  },
  mesi: {
    label: "Mesi/Voci",
    icon: CalendarDays,
  },
};

function makeId() {
  return crypto.randomUUID();
}

export function PdfEditor({ initialSettings, userId }: PdfEditorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.55);
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

  const [autoFit, setAutoFit] = useState(true);
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
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [guides, setGuides] = useState<GuideLines>({});
  const [clipboard, setClipboard] = useState<{
    blocks: Blocco[];
    isCut: boolean;
  } | null>(null);
  const pasteCountRef = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isMod = e.ctrlKey || e.metaKey;
      const isZoomIn = isMod && (e.key === "+" || e.key === "Add" || e.key === "=");
      const isZoomOut = isMod && (e.key === "-" || e.key === "Subtract");

      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable
      ) {
        if (!(isMouseOverCanvas.current && (isZoomIn || isZoomOut))) return;
      }

      if (isZoomIn) {
        e.preventDefault();
        setAutoFit(false);
        setZoom((z) => clamp(z + 0.1, 0.3, 1.5));
        return;
      }
      if (isZoomOut) {
        e.preventDefault();
        setAutoFit(false);
        setZoom((z) => clamp(z - 0.1, 0.3, 1.5));
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) {
          e.preventDefault();
          selectedIds.forEach((id) => removeBlock(id));
        }
        return;
      }

      if (!isMod) return;

      if ((e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" || e.key === "Z") && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setSelectedIds((prev) => {
          if (prev.size === settings.blocchi.length) return new Set();
          return new Set(settings.blocchi.map((b) => b.id));
        });
      } else if ((e.key === "c" || e.key === "C") && selectedIds.size > 0) {
        e.preventDefault();
        const blocks = settings.blocchi.filter((b) => selectedIds.has(b.id));
        setClipboard({ blocks: blocks.map((b) => ({ ...b })), isCut: false });
        pasteCountRef.current = 0;
      } else if ((e.key === "x" || e.key === "X") && selectedIds.size > 0) {
        e.preventDefault();
        const blocks = settings.blocchi.filter((b) => selectedIds.has(b.id));
        setClipboard({ blocks: blocks.map((b) => ({ ...b })), isCut: true });
        pasteCountRef.current = 0;
        blocks.forEach((b) => removeBlock(b.id));
      } else if ((e.key === "v" || e.key === "V") && clipboard) {
        e.preventDefault();
        pasteCountRef.current += 1;
        const offset = pasteCountRef.current * 20;
        const newIds: string[] = [];
        const newBlocks = clipboard.blocks.map((block) => {
          const id = makeId();
          newIds.push(id);
          return {
            ...block,
            id,
            x: clamp(block.x + offset, 0, PAGE_W - block.width),
            y: clamp(block.y + offset, 0, PAGE_H - block.height),
          };
        });
        pushSettings((prev) => ({
          ...prev,
          blocchi: [...prev.blocchi, ...newBlocks],
        }));
        setSelectedIds(new Set(newIds));
        if (clipboard.isCut) {
          setClipboard(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedIds,
    settings.blocchi,
    clipboard,
    removeBlock,
    undo,
    redo,
    pushSettings,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setAutoFit(false);
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => clamp(z + delta, 0.3, 1.5));
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = canvas.scrollLeft;
      startScrollTop = canvas.scrollTop;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      canvas.scrollLeft = startScrollLeft - dx;
      canvas.scrollTop = startScrollTop - dy;
    };

    const handleMouseUp = () => {
      isPanning = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      handleMouseUp();
    };
  }, []);

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

  const fitZoom = useCallback(() => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const padding = 32; // spazio interno p-4 * 2
    const availableW = rect.width - padding;
    const availableH = rect.height - padding;
    const scaleW = availableW / PAGE_W;
    const scaleH = availableH / PAGE_H;
    const next = clamp(Math.min(scaleW, scaleH) * 0.95, 0.3, 1.5);
    setZoom(next);
  }, []);

  useEffect(() => {
    if (!autoFit) return;
    fitZoom();

    const el = canvasRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      fitZoom();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoFit, fitZoom]);

  const handleDragStart = useCallback(
    (id: string) => {
      const block = settings.blocchi.find((b) => b.id === id);
      if (!block) return;
      setDragging({ id, x: block.x, y: block.y });
      setSelectedIds(new Set([id]));
      setGuides({});
    },
    [settings.blocchi, setSelectedIds]
  );

  const handleDrag = useCallback(
    (id: string, x: number, y: number) => {
      const block = settings.blocchi.find((b) => b.id === id);
      if (!block) return;
      const others = settings.blocchi.filter((b) => b.id !== id);
      const snapped = computeSnap(block, x, y, others);
      setDragging({ id, x: snapped.x, y: snapped.y });
      setGuides(snapped.guides);
    },
    [settings.blocchi]
  );

  const handleDragStop = useCallback(
    (id: string) => {
      setDragging((current) => {
        if (!current || current.id !== id) return current;
        updateBlock(id, { x: current.x, y: current.y });
        return null;
      });
      setGuides({});
    },
    [updateBlock]
  );

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Button
            variant={autoFit ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setAutoFit(true);
              fitZoom();
            }}
            title="Adatta alla finestra"
          >
            <Maximize className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAutoFit(false);
              setZoom((z) => clamp(z - 0.1, 0.3, 1.5));
            }}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-[4rem] text-center text-sm font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAutoFit(false);
              setZoom((z) => clamp(z + 0.1, 0.3, 1.5));
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant={showGrid ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowGrid((v) => !v)}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={previewMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setPreviewMode((v) => !v);
              setSelectedIds(new Set());
              stopEditing();
            }}
          >
            <Eye className="mr-1 h-4 w-4" />
            {previewMode ? "Modifica" : "Anteprima"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            title="Annulla"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            title="Ripeti"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetOpen(true)}
          >
            <RefreshCcw className="mr-1 h-4 w-4" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            <Save className="mr-1 h-4 w-4" />
            {isPending ? "Salvataggio..." : "Salva modifiche"}
          </Button>
        </div>
      </div>

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
        <div className="order-2 flex flex-col gap-2 lg:order-1 lg:w-44 lg:max-h-full lg:overflow-auto">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Aggiungi blocco
          </p>
          {(Object.keys(PRESETS) as TipoBlocco[]).map((tipo) => {
            const Icon = PRESETS[tipo].icon;
            return (
              <Button
                key={tipo}
                variant="outline"
                className="justify-start"
                size="sm"
                onClick={() => addBlock(tipo)}
                disabled={previewMode}
              >
                <Icon className="mr-2 h-4 w-4" />
                {PRESETS[tipo].label}
              </Button>
            );
          })}

          <div className="mt-4 rounded-md border p-3 text-xs text-muted-foreground">
            <p className="mb-2 font-semibold uppercase">Comandi rapidi</p>
            <div className="space-y-1">
              <p>
                <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
                <span className="rounded border px-1 font-mono">A</span> — Seleziona tutti
              </p>
              <p>
                <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
                <span className="rounded border px-1 font-mono">+</span> — Zoom avanti
              </p>
              <p>
                <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
                <span className="rounded border px-1 font-mono">-</span> — Zoom indietro
              </p>
              <p>
                <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
                <span className="rounded border px-1 font-mono">Z</span> — Annulla
              </p>
              <p>
                <span className="rounded border px-1 font-mono">Tasto</span> +{" "}
                <span className="rounded border px-1 font-mono">centrale</span> — Pan
              </p>
              <p>
                <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
                <span className="rounded border px-1 font-mono">C</span> — Copia
              </p>
              <p>
                <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
                <span className="rounded border px-1 font-mono">X</span> — Taglia
              </p>
              <p>
                <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
                <span className="rounded border px-1 font-mono">V</span> — Incolla
              </p>
              <p>
                <span className="rounded border px-1 font-mono">Canc</span> — Elimina
              </p>
            </div>
          </div>
        </div>

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
            <div className="rounded-lg border p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-medium"
                onClick={() => setPageSettingsOpen((v) => !v)}
              >
                <span>Impostazioni pagina</span>
                {pageSettingsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {pageSettingsOpen && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Margini foglio
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="marginTop">Alto</Label>
                      <Input
                        id="marginTop"
                        type="number"
                        min={0}
                        max={400}
                        value={settings.marginTop}
                        onChange={(e) =>
                          updateSettings({
                            marginTop: clamp(toNumber(e.target.value), 0, 400),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="marginRight">Destra</Label>
                      <Input
                        id="marginRight"
                        type="number"
                        min={0}
                        max={400}
                        value={settings.marginRight}
                        onChange={(e) =>
                          updateSettings({
                            marginRight: clamp(toNumber(e.target.value), 0, 400),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="marginBottom">Basso</Label>
                      <Input
                        id="marginBottom"
                        type="number"
                        min={0}
                        max={400}
                        value={settings.marginBottom}
                        onChange={(e) =>
                          updateSettings({
                            marginBottom: clamp(toNumber(e.target.value), 0, 400),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="marginLeft">Sinistra</Label>
                      <Input
                        id="marginLeft"
                        type="number"
                        min={0}
                        max={400}
                        value={settings.marginLeft}
                        onChange={(e) =>
                          updateSettings({
                            marginLeft: clamp(toNumber(e.target.value), 0, 400),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
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

function renderFormattedSegments(text: string, keyPrefix: string) {
  return parseInlineFormatting(text).map((segment, idx) => (
    <span
      key={`${keyPrefix}-${idx}`}
      style={{
        fontWeight: segment.bold ? 700 : undefined,
        fontStyle: segment.italic ? "italic" : undefined,
        color: segment.gray ? "#9ca3af" : undefined,
      }}
    >
      {segment.text}
    </span>
  ));
}

/**
 * Render statico (blocco non in editing, non in preview) del testo grezzo con
 * chip al posto di {{...}} in chiaro — stesso badge mostrato durante l'editing
 * (VariableChipBadge), così il chip resta visibile anche dopo aver deselezionato
 * il blocco, invece di tornare a mostrare la sintassi {{...}}.
 */
function renderRichStatic(testo: string, keyPrefix: string) {
  const doc = parseTestoToRichContent(testo);
  return doc.content.map((paragraph, pIdx) => {
    const nodes = paragraph.content ?? [];
    return (
      <div key={`${keyPrefix}-p-${pIdx}`}>
        {nodes.length === 0
          ? " "
          : nodes.map((node, nIdx) => {
              const key = `${keyPrefix}-${pIdx}-${nIdx}`;
              const marks = node.marks ?? [];
              const bold = marks.some((m) => m.type === "bold");
              const italic = marks.some((m) => m.type === "italic");
              const nota = marks.some((m) => m.type === "nota");

              if (node.type === "variable") {
                return (
                  <VariableChipBadge
                    key={key}
                    label={node.attrs.label}
                    bold={bold}
                    italic={italic}
                    nota={nota}
                  />
                );
              }

              return (
                <span
                  key={key}
                  style={{
                    fontWeight: bold ? 700 : undefined,
                    fontStyle: italic ? "italic" : undefined,
                    color: nota ? "#9ca3af" : undefined,
                  }}
                >
                  {node.text}
                </span>
              );
            })}
      </div>
    );
  });
}

function Block({
  blocco,
  isSelected,
  isEditing,
  isPreview,
  zoom,
  dragPosition,
  onSelect,
  onStartEditing,
  onExitEditing,
  onEditorReady,
  onDragStart,
  onDrag,
  onDragStop,
  onUpdate,
}: {
  blocco: Blocco;
  isSelected: boolean;
  isEditing: boolean;
  isPreview: boolean;
  zoom: number;
  dragPosition?: { x: number; y: number };
  onSelect: () => void;
  onStartEditing: () => void;
  onExitEditing: () => void;
  onEditorReady: (editor: Editor | null) => void;
  onDragStart?: () => void;
  onDrag?: (e: unknown, data: { x: number; y: number }) => void;
  onDragStop?: () => void;
  onUpdate: (patch: Partial<Blocco>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const [resizeDimensions, setResizeDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const mockInvoice = useMemo(() => buildMockInvoice(), []);
  const displayText = isPreview
    ? resolvePlaceholders(blocco.testo ?? "", mockInvoice)
    : blocco.testo ?? "";
  const mesiPreviewRows = useMemo(() => {
    if (blocco.tipo !== "mesi" || !blocco.meseConfig || !isPreview) return null;
    return renderMesiRows(blocco.meseConfig, mockInvoice);
  }, [blocco.tipo, blocco.meseConfig, mockInvoice, isPreview]);

  const position = useMemo(
    () => dragPosition ?? { x: blocco.x, y: blocco.y },
    [dragPosition, blocco.x, blocco.y]
  );

  const getParentRect = useCallback(() => {
    const parent = ref.current?.parentElement;
    return parent?.getBoundingClientRect();
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPreview) return;
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).dataset.resize != null) return;
      if ((e.target as HTMLElement).closest("[data-rich-editor-content]")) {
        // Il click cade dentro l'editor ricco montato (isEditing): lascia che
        // TipTap gestisca il posizionamento nativo del cursore, non avviare drag.
        return;
      }
      e.preventDefault();
      const rect = getParentRect();
      if (!rect) return;
      const mouseX = (e.clientX - rect.left) / zoom;
      const mouseY = (e.clientY - rect.top) / zoom;
      const offsetX = mouseX - position.x;
      const offsetY = mouseY - position.y;
      onSelect();
      onDragStart?.();

      const handleMove = (ev: PointerEvent) => {
        const mx = (ev.clientX - rect.left) / zoom;
        const my = (ev.clientY - rect.top) / zoom;
        onDrag?.(null, {
          x: mx - offsetX,
          y: my - offsetY,
        });
      };

      const handleUp = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        onDragStop?.();
      };

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [isPreview, zoom, position, getParentRect, onSelect, onDragStart, onDrag, onDragStop]
  );

  const handleResizeDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPreview) return;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = getParentRect();
      if (!rect) return;
      const startX = (e.clientX - rect.left) / zoom;
      const startY = (e.clientY - rect.top) / zoom;
      const startW = blocco.width;
      const startH = blocco.height;
      setResizing(true);
      setResizeDimensions({ width: startW, height: startH });

      const handleMove = (ev: PointerEvent) => {
        const mx = (ev.clientX - rect.left) / zoom;
        const my = (ev.clientY - rect.top) / zoom;
        setResizeDimensions({
          width: clamp(startW + (mx - startX), 10, PAGE_W - position.x),
          height: clamp(startH + (my - startY), 10, PAGE_H - position.y),
        });
      };

      const handleUp = () => {
        setResizing(false);
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        setResizeDimensions((current) => {
          if (current) onUpdate({ width: current.width, height: current.height });
          return null;
        });
      };

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [isPreview, zoom, blocco.width, blocco.height, position, getParentRect, onUpdate]
  );

  if (isPreview && !blocco.visible) return null;

  const canRichEdit = blocco.tipo !== "mesi";

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={isPreview ? -1 : 0}
      aria-label={`Blocco ${PRESETS[blocco.tipo].label}${isSelected ? ", selezionato" : ""}`}
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        // Quando il blocco è in editing, l'editor TipTap nidificato
        // (RichTextBlockEditor) è un contenteditable dentro questo stesso
        // div: un keydown di Spazio/Invio digitato lì risale (bubbling) fino
        // a qui. Senza questa guardia, preventDefault() sotto blocca
        // l'inserimento del carattere nel testo — stesso motivo per cui
        // handlePointerDown già ignora i click dentro
        // "[data-rich-editor-content]".
        if (isPreview || isEditing) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onDoubleClick={() => {
        if (isPreview || !canRichEdit) return;
        onStartEditing();
      }}
      className={cn(
        "group absolute border border-transparent",
        !isPreview &&
          (isSelected
            ? "border-primary bg-primary/5"
            : "cursor-move hover:border-muted-foreground/30"),
        !blocco.visible && !isPreview && "opacity-50",
        resizing && "border-primary"
      )}
      style={{
        left: position.x,
        top: position.y,
        width: resizeDimensions?.width ?? blocco.width,
        height: resizeDimensions?.height ?? blocco.height,
      }}
    >
      {!isPreview && isSelected && (
        <div
          className="pointer-events-none absolute border border-dashed border-muted-foreground/40"
          style={{
            top: blocco.paddingTop ?? 0,
            right: blocco.paddingRight ?? 0,
            bottom: blocco.paddingBottom ?? 0,
            left: blocco.paddingLeft ?? 0,
          }}
        />
      )}
      {!isPreview && blocco.tipo !== "testo" && (
        <span className="pointer-events-none absolute -top-4 right-0 whitespace-nowrap rounded bg-muted px-1 text-[10px] text-muted-foreground">
          {PRESETS[blocco.tipo].label}
        </span>
      )}
      <div
        className="h-full w-full overflow-hidden"
        style={{
          fontSize: blocco.fontSize,
          textAlign: blocco.align,
          fontFamily: "Helvetica, Arial, sans-serif",
          fontWeight: blocco.fontWeight === "bold" ? 700 : 400,
          color: blocco.color ?? "#000000",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          paddingTop: blocco.paddingTop ?? 0,
          paddingRight: blocco.paddingRight ?? 0,
          paddingBottom: blocco.paddingBottom ?? 0,
          paddingLeft: blocco.paddingLeft ?? 0,
        }}
      >
      {blocco.tipo === "mesi" ? (
        <div className="w-full">
          {blocco.meseConfig?.titolo && (
            <div style={{ fontWeight: 700 }}>{blocco.meseConfig.titolo}</div>
          )}
          {mesiPreviewRows ? (
            mesiPreviewRows.map((row, idx) => (
              <div
                key={idx}
                style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
              >
                <span>{renderFormattedSegments(row.descrizione, `d-${idx}`)}</span>
                <span>{renderFormattedSegments(row.valore, `v-${idx}`)}</span>
              </div>
            ))
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>{renderRichStatic(blocco.meseConfig?.descrizioneTemplate ?? "", "mesi-d")}</div>
                <div>{renderRichStatic(blocco.meseConfig?.valoreTemplate ?? "", "mesi-v")}</div>
              </div>
              {blocco.meseConfig?.mostraTotale && (
                <div
                  style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 700 }}
                >
                  <span>{blocco.meseConfig.totaleLabel ?? "Totale"}</span>
                  <div>{renderRichStatic("{{fattura.prezzoTotale}}", "mesi-tot")}</div>
                </div>
              )}
            </>
          )}
        </div>
      ) : !isPreview && isEditing && canRichEdit ? (
        <RichTextBlockEditor
          testo={blocco.testo ?? ""}
          richContent={blocco.richContent}
          onCommit={(patch) => onUpdate(patch)}
          onEditorReady={onEditorReady}
          onExit={onExitEditing}
        />
      ) : isPreview ? (
        renderFormattedSegments(displayText, "seg")
      ) : (
        renderRichStatic(blocco.testo ?? "", "seg")
      )}
      </div>
      {!isPreview && (
        <div
          data-resize
          role="button"
          tabIndex={isPreview ? -1 : 0}
          aria-label="Ridimensiona blocco"
          onPointerDown={handleResizeDown}
          className="absolute bottom-0 right-0 z-10 h-3 w-3 cursor-se-resize bg-primary opacity-0 transition-opacity group-hover:opacity-100"
          title="Ridimensiona"
        />
      )}
    </div>
  );
}
