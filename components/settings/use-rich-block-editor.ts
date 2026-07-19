"use client";

import { useEffect, useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  parseTestoToRichContent,
  serializeRichContentToTesto,
  type RichTextDoc,
} from "@/lib/pdf/rich-text";
import { NotaMark, VariableNode } from "@/components/settings/pdf-editor-rich-extensions";

const COMMIT_DEBOUNCE_MS = 600;

export type RichBlockCommit = { testo: string; richContent: RichTextDoc };

const RichStarterKit = StarterKit.configure({
  heading: false,
  bulletList: false,
  orderedList: false,
  listItem: false,
  blockquote: false,
  codeBlock: false,
  horizontalRule: false,
  strike: false,
  code: false,
  hardBreak: false,
  link: false,
  underline: false,
  dropcursor: false,
  gapcursor: false,
});

const RICH_EDITOR_EXTENSIONS: AnyExtension[] = [RichStarterKit, NotaMark, VariableNode];

type UseRichBlockEditorOptions = {
  testo: string;
  richContent?: RichTextDoc;
  onCommit: (patch: RichBlockCommit) => void;
  onEditorReady?: (editor: Editor | null) => void;
  onExit?: () => void;
};

/**
 * Istanzia un editor TipTap "committabile": ogni modifica viene serializzata
 * verso `testo`/`richContent` con un debounce, così le micro-modifiche di
 * digitazione non finiscono una per una nella history di layout (vedi
 * pdf-editor.tsx: il commit alimenta `updateBlock`/`pushSettings`, che è
 * quello a cui risponde l'undo/redo a livello layout).
 */
export function useRichBlockEditor({
  testo,
  richContent,
  onCommit,
  onEditorReady,
  onExit,
}: UseRichBlockEditorOptions): Editor | null {
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDoc = useRef<RichTextDoc | null>(null);

  const flushCommit = () => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    if (!latestDoc.current) return;
    const doc = latestDoc.current;
    onCommit({ testo: serializeRichContentToTesto(doc), richContent: doc });
  };

  const editor = useEditor({
    extensions: RICH_EDITOR_EXTENSIONS,
    content: (richContent ?? parseTestoToRichContent(testo)) as unknown as object,
    immediatelyRender: false,
    autofocus: "end",
    onUpdate: ({ editor: ed }) => {
      // `ed.getJSON()` può portare con sé proprietà non enumerabili (bookkeeping
      // interno di TipTap/ProseMirror sui nodi con NodeView, es. il nodo
      // "variable") che un giro su JSON.stringify/parse elimina, garantendo che
      // solo dati piano-JSON entrino nello stato React e vengano poi inviati
      // alla server action `updatePdfSettings` (altrimenti Next.js tratta quei
      // valori come "temporary client reference" e il salvataggio fallisce).
      latestDoc.current = JSON.parse(JSON.stringify(ed.getJSON())) as RichTextDoc;
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(flushCommit, COMMIT_DEBOUNCE_MS);
    },
    onBlur: () => {
      flushCommit();
    },
    editorProps: {
      attributes: {
        "data-rich-editor-content": "true",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          flushCommit();
          onExit?.();
          return true;
        }
        return false;
      },
    },
  }, []);

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => {
      flushCommit();
      onEditorReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return editor;
}
