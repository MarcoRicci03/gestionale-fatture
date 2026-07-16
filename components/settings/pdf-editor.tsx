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
  ArrowDown,
  ArrowUp,
  Bold,
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
import { buildMockInvoice, resolvePlaceholders } from "@/lib/pdf/placeholders";
import { parseInlineFormatting } from "@/lib/pdf/formatting";
import type {
  Blocco,
  ImpostazioniPdf,
  PdfSettingsInput,
  TipoBlocco,
} from "@/lib/pdf/types";

type PdfEditorProps = {
  initialSettings: ImpostazioniPdf;
  userId: number;
};

const PAGE_W = 595;
const PAGE_H = 842;
const SNAP_THRESHOLD = 8;

type GuideLines = { x?: number; y?: number };
type DraggingState = { id: string; x: number; y: number };

const PRESETS: Record<
  TipoBlocco,
  { label: string; icon: React.ElementType; defaultText: string }
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
};

const PLACEHOLDER_GROUPS: {
  label: string;
  items: { label: string; value: string }[];
}[] = [
  {
    label: "Mittente",
    items: [
      {
        label: "Titolo, nome, cognome, spec.",
        value: "{{mittente.titoloNomeCognomeSpec}}",
      },
      { label: "Via", value: "{{mittente.via}}" },
      { label: "CAP", value: "{{mittente.cap}}" },
      { label: "Città e provincia", value: "{{mittente.cittaProvincia}}" },
      { label: "CAP, città e provincia", value: "{{mittente.capCittaProvincia}}" },
      { label: "Partita IVA", value: "{{mittente.pIva}}" },
      { label: "Codice fiscale", value: "{{mittente.cf}}" },
    ],
  },
  {
    label: "Intestatario",
    items: [
      { label: "Cognome e nome", value: "{{intestatario.cognomeNome}}" },
      { label: "Via", value: "{{intestatario.via}}" },
      { label: "CAP e città", value: "{{intestatario.capCitta}}" },
      { label: "CF o P.IVA", value: "{{intestatario.cfOppurePiva}}" },
      { label: "CF", value: "{{intestatario.cf}}" },
      { label: "P.IVA", value: "{{intestatario.piva}}" },
    ],
  },
  {
    label: "Paziente",
    items: [{ label: "Cognome e nome", value: "{{paziente.cognomeNome}}" }],
  },
  {
    label: "Fattura",
    items: [
      { label: "Numero", value: "{{fattura.numero}}" },
      { label: "Data", value: "{{fattura.data}}" },
      { label: "Importo totale", value: "{{fattura.prezzoTotale}}" },
      { label: "Modalità pagamento", value: "{{fattura.modalitaPagamento}}" },
      { label: "Sedute", value: "{{fattura.sedute}}" },
      { label: "Commento", value: "{{fattura.commento}}" },
      { label: "Città", value: "{{fattura.citta}}" },
      { label: "CAP", value: "{{fattura.cap}}" },
      { label: "Mesi", value: "{{fattura.mesi}}" },
    ],
  },
  {
    label: "Mese",
    items: [
      { label: "Nome mese/i", value: "{{mese.nome}}" },
      { label: "Anno", value: "{{mese.anno}}" },
    ],
  },
];

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

export function PdfEditor({ initialSettings, userId }: PdfEditorProps) {
  const [editorState, setEditorState] = useState<{
    history: ImpostazioniPdf[];
    index: number;
  }>({
    history: [initialSettings],
    index: 0,
  });
  const settings = editorState.history[editorState.index];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.55);

  const pushSettings = useCallback(
    (
      next:
        | ImpostazioniPdf
        | ((prev: ImpostazioniPdf) => ImpostazioniPdf)
    ) => {
      setEditorState((state) => {
        const current = state.history[state.index];
        const resolved =
          typeof next === "function"
            ? (next as (prev: ImpostazioniPdf) => ImpostazioniPdf)(current)
            : next;
        if (resolved === current) return state;
        const nextHistory = [
          ...state.history.slice(0, state.index + 1),
          resolved,
        ];
        return { history: nextHistory, index: state.index + 1 };
      });
    },
    []
  );

  const undo = useCallback(() => {
    if (editorState.index <= 0) return;
    const nextIndex = editorState.index - 1;
    const nextSettings = editorState.history[nextIndex];
    setEditorState({ ...editorState, index: nextIndex });
    const validIds = new Set<string>();
    selectedIds.forEach((id) => {
      if (nextSettings.blocchi.some((b) => b.id === id)) validIds.add(id);
    });
    setSelectedIds(validIds);
  }, [editorState, selectedIds]);

  const redo = useCallback(() => {
    if (editorState.index >= editorState.history.length - 1) return;
    const nextIndex = editorState.index + 1;
    const nextSettings = editorState.history[nextIndex];
    setEditorState({ ...editorState, index: nextIndex });
    const validIds = new Set<string>();
    selectedIds.forEach((id) => {
      if (nextSettings.blocchi.some((b) => b.id === id)) validIds.add(id);
    });
    setSelectedIds(validIds);
  }, [editorState, selectedIds]);

  const canUndo = editorState.index > 0;
  const canRedo = editorState.index < editorState.history.length - 1;
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

  const [resetOpen, setResetOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [guides, setGuides] = useState<GuideLines>({});
  const [clipboard, setClipboard] = useState<{
    blocks: Blocco[];
    isCut: boolean;
  } | null>(null);
  const pasteCountRef = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isMouseOverCanvas = useRef(false);
  const testoRef = useRef<HTMLTextAreaElement>(null);

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

  const insertPlaceholder = useCallback(
    (placeholder: string) => {
      if (!selectedBlock) return;
      const el = testoRef.current;
      const currentText = selectedBlock.testo ?? "";
      let newText: string;
      let cursorPos = 0;
      if (el) {
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        newText =
          currentText.slice(0, start) + placeholder + currentText.slice(end);
        cursorPos = start + placeholder.length;
      } else {
        newText = currentText + placeholder;
        cursorPos = newText.length;
      }
      updateBlock(selectedBlock.id, { testo: newText });
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.selectionStart = el.selectionEnd = cursorPos;
      });
    },
    [selectedBlock, updateBlock]
  );

  const wrapText = useCallback(
    (prefix: string, suffix: string) => {
      if (!selectedBlock) return;
      const el = testoRef.current;
      const currentText = selectedBlock.testo ?? "";
      let newText: string;
      let newStart = 0;
      let newEnd = 0;
      if (el) {
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        const before = currentText.slice(0, start);
        const selected = currentText.slice(start, end);
        const after = currentText.slice(end);
        newText = before + prefix + selected + suffix + after;
        newStart = start + prefix.length;
        newEnd = end + prefix.length;
      } else {
        newText = currentText + prefix + suffix;
        newStart = newText.length - suffix.length;
        newEnd = newStart;
      }
      updateBlock(selectedBlock.id, { testo: newText });
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.selectionStart = newStart;
        el.selectionEnd = newEnd;
      });
    },
    [selectedBlock, updateBlock]
  );

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
        testo: preset.defaultText,
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

  const computeSnap = useCallback(
    (dragged: Blocco, x: number, y: number, others: Blocco[]) => {
      const draggedLinesX = [
        { value: x, type: "left" },
        { value: x + dragged.width / 2, type: "center" },
        { value: x + dragged.width, type: "right" },
      ];
      const draggedLinesY = [
        { value: y, type: "top" },
        { value: y + dragged.height / 2, type: "middle" },
        { value: y + dragged.height, type: "bottom" },
      ];

      let snapX: { offset: number; line: number } | null = null;
      let snapY: { offset: number; line: number } | null = null;

      for (const other of others) {
        if (other.id === dragged.id) continue;
        const otherLinesX = [
          other.x,
          other.x + other.width / 2,
          other.x + other.width,
        ];
        const otherLinesY = [
          other.y,
          other.y + other.height / 2,
          other.y + other.height,
        ];

        for (const dl of draggedLinesX) {
          for (const ol of otherLinesX) {
            const diff = dl.value - ol;
            if (Math.abs(diff) <= SNAP_THRESHOLD) {
              if (!snapX || Math.abs(diff) < Math.abs(snapX.offset)) {
                snapX = { offset: diff, line: ol };
              }
            }
          }
        }

        for (const dl of draggedLinesY) {
          for (const ol of otherLinesY) {
            const diff = dl.value - ol;
            if (Math.abs(diff) <= SNAP_THRESHOLD) {
              if (!snapY || Math.abs(diff) < Math.abs(snapY.offset)) {
                snapY = { offset: diff, line: ol };
              }
            }
          }
        }
      }

      const result = { x, y, guides: {} as GuideLines };
      if (snapX) {
        result.x = clamp(x - snapX.offset, 0, PAGE_W - dragged.width);
        result.guides.x = snapX.line;
      }
      if (snapY) {
        result.y = clamp(y - snapY.offset, 0, PAGE_H - dragged.height);
        result.guides.y = snapY.line;
      }
      return result;
    },
    []
  );

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
    [settings.blocchi, computeSnap]
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
    setResetOpen(false);
  }, [settings.id, userId, pushSettings]);

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
          className="order-1 flex h-[calc(100vh-340px)] flex-1 cursor-grab justify-center overflow-auto rounded-lg border bg-muted/20 p-4 active:cursor-grabbing lg:order-2"
          onMouseEnter={() => {
            isMouseOverCanvas.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverCanvas.current = false;
          }}
        >
          <div
            className="relative bg-white shadow-sm"
            style={{
              width: PAGE_W,
              height: PAGE_H,
              zoom,
              flexShrink: 0,
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

            {settings.blocchi.map((blocco) => (
              <Block
                key={blocco.id}
                blocco={blocco}
                isSelected={selectedIds.has(blocco.id)}
                isPreview={previewMode}
                zoom={zoom}
                dragPosition={
                  dragging?.id === blocco.id
                    ? { x: dragging.x, y: dragging.y }
                    : undefined
                }
                onSelect={() => setSelectedIds(new Set([blocco.id]))}
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
        <div className="order-3 w-full lg:w-72 lg:max-h-full lg:overflow-auto">
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

              <div className="space-y-3">
                <Label htmlFor="testo">Contenuto</Label>
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
                    updateBlock(selectedBlock.id, { testo: e.target.value })
                  }
                />
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
                              onClick={() => insertPlaceholder(item.value)}
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

              <div className="grid grid-cols-2 gap-3">
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

function Block({
  blocco,
  isSelected,
  isPreview,
  zoom,
  dragPosition,
  onSelect,
  onDragStart,
  onDrag,
  onDragStop,
  onUpdate,
}: {
  blocco: Blocco;
  isSelected: boolean;
  isPreview: boolean;
  zoom: number;
  dragPosition?: { x: number; y: number };
  onSelect: () => void;
  onDragStart?: () => void;
  onDrag?: (e: unknown, data: { x: number; y: number }) => void;
  onDragStop?: () => void;
  onUpdate: (patch: Partial<Blocco>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const mockInvoice = useMemo(() => buildMockInvoice(), []);
  const displayText = isPreview
    ? resolvePlaceholders(blocco.testo ?? "", mockInvoice)
    : blocco.testo ?? "";

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

      const handleMove = (ev: PointerEvent) => {
        const mx = (ev.clientX - rect.left) / zoom;
        const my = (ev.clientY - rect.top) / zoom;
        onUpdate({
          width: clamp(startW + (mx - startX), 10, PAGE_W - position.x),
          height: clamp(startH + (my - startY), 10, PAGE_H - position.y),
        });
      };

      const handleUp = () => {
        setResizing(false);
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
      };

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [isPreview, zoom, blocco.width, blocco.height, position, getParentRect, onUpdate]
  );

  if (isPreview && !blocco.visible) return null;

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      className={cn(
        "group absolute overflow-hidden border border-transparent",
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
        width: blocco.width,
        height: blocco.height,
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
      {parseInlineFormatting(displayText).map((segment, idx) => (
        <span
          key={idx}
          style={{
            fontWeight: segment.bold ? 700 : undefined,
            fontStyle: segment.italic ? "italic" : undefined,
            color: segment.gray ? "#9ca3af" : undefined,
          }}
        >
          {segment.text}
        </span>
      ))}
      {!isPreview && blocco.tipo !== "testo" && (
        <span className="pointer-events-none absolute right-1 top-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
          {PRESETS[blocco.tipo].label}
        </span>
      )}
      {!isPreview && (
        <div
          data-resize
          onPointerDown={handleResizeDown}
          className="absolute bottom-0 right-0 z-10 h-3 w-3 cursor-se-resize bg-primary opacity-0 transition-opacity group-hover:opacity-100"
          title="Ridimensiona"
        />
      )}
    </div>
  );
}
