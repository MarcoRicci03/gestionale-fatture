"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { buildMockInvoice, resolvePlaceholders, renderMesiRows } from "@/lib/pdf/placeholders";
import { parseInlineFormatting } from "@/lib/pdf/formatting";
import { parseTestoToRichContent } from "@/lib/pdf/rich-text";
import { RichTextBlockEditor } from "@/components/settings/pdf-editor-rich-block";
import { VariableChipBadge } from "@/components/settings/pdf-editor-rich-extensions";
import { PAGE_W, PAGE_H, clamp } from "@/lib/pdf/canvas-geometry";
import { PRESETS } from "@/components/settings/pdf-editor-presets";
import type { Blocco } from "@/lib/pdf/types";

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
          ? " "
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

export function Block({
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
