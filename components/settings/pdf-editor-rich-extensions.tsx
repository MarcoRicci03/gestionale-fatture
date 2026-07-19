"use client";

import { Mark, Node, mergeAttributes } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { cn } from "@/lib/utils";

/**
 * Mark "nota" (testo grigio) — equivalente del tag legacy `<note>...</note>`
 * consumato da lib/pdf/formatting.ts. Nessuna semantica HTML reale, serve solo
 * a rappresentare visivamente lo stesso stile già supportato dal PDF finale.
 */
export const NotaMark = Mark.create({
  name: "nota",

  parseHTML() {
    return [{ tag: "span[data-nota]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-nota": "",
        style: "color: #9ca3af",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleNota:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    nota: {
      toggleNota: () => ReturnType;
    };
  }
}

/**
 * Presentazione pura del badge-chip, condivisa tra il NodeView di editing
 * (marks letti dalle istanze ProseMirror `node.marks`, `m.type.name`) e il
 * render statico di pdf-editor.tsx (marks letti dalla forma JSON semplice
 * `{ type: string }[]` prodotta da lib/pdf/rich-text.ts) — nessuna delle due
 * shape è nota qui, il chiamante passa solo booleani già risolti.
 */
export function VariableChipBadge({
  label,
  bold,
  italic,
  nota,
}: {
  label: string;
  bold?: boolean;
  italic?: boolean;
  nota?: boolean;
}) {
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex select-none items-center rounded-full bg-primary/10 px-1.5 py-0.5 align-baseline text-[11px] leading-none text-primary",
        nota && "opacity-70"
      )}
      style={{
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? "italic" : undefined,
      }}
    >
      {label}
    </span>
  );
}

function VariableChipView({ node }: NodeViewProps) {
  const hasMark = (name: string) =>
    node.marks.some((m) => m.type.name === name);

  return (
    <NodeViewWrapper as="span" contentEditable={false} className="align-baseline">
      <VariableChipBadge
        label={node.attrs.label}
        bold={hasMark("bold")}
        italic={hasMark("italic")}
        nota={hasMark("nota")}
      />
    </NodeViewWrapper>
  );
}

/**
 * Nodo "chip" per una variabile dinamica ({{...}}). Atomico e non editabile:
 * l'utente lo vede solo come badge, mai come sintassi {{}} in chiaro.
 * `attrs.placeholder` conserva la stringa {{...}} originale per il bridge
 * di serializzazione verso `Blocco.testo` (lib/pdf/rich-text.ts).
 */
export const VariableNode = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      placeholder: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },

  renderHTML({ node }) {
    return [
      "span",
      { "data-variable": "", "data-placeholder": node.attrs.placeholder },
      node.attrs.label,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChipView);
  },

  addCommands() {
    return {
      insertVariable:
        (attrs: { placeholder: string; label: string }) =>
        ({ commands, state }) => {
          // Eredita i marks correnti (bold/italic/nota) del punto di inserimento,
          // così attivare Grassetto e poi inserire un valore dinamico produce
          // subito un chip in grassetto invece di doverlo selezionare a posteriori.
          const activeMarks = state.storedMarks ?? state.selection.$from.marks();
          const marks = activeMarks
            .filter((m) => ["bold", "italic", "nota"].includes(m.type.name))
            .map((m) => ({ type: m.type.name }));

          return commands.insertContent({
            type: this.name,
            attrs,
            ...(marks.length > 0 ? { marks } : {}),
          });
        },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (attrs: { placeholder: string; label: string }) => ReturnType;
    };
  }
}
