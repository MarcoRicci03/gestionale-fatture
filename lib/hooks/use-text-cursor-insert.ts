"use client";

import { useCallback, useRef } from "react";

/**
 * Inserimento/wrap di testo alla posizione del cursore di una textarea controllata.
 * Condiviso tra pdf-editor.tsx e pdf-editor-mesi-panel.tsx per evitare di duplicare
 * la stessa logica selectionStart/selectionEnd in più punti.
 */
export function useTextCursorInsert(
  value: string,
  onChange: (next: string) => void
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = useCallback(
    (insert: string) => {
      const el = ref.current;
      if (!el) {
        onChange(value + insert);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + insert + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + insert.length;
      });
    },
    [value, onChange]
  );

  const wrapSelection = useCallback(
    (prefix: string, suffix: string) => {
      const el = ref.current;
      if (!el) {
        onChange(prefix + value + suffix);
        return;
      }
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const before = value.slice(0, start);
      const selected = value.slice(start, end);
      const after = value.slice(end);
      const newStart = start + prefix.length;
      const newEnd = end + prefix.length;
      onChange(before + prefix + selected + suffix + after);
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = newStart;
        el.selectionEnd = newEnd;
      });
    },
    [value, onChange]
  );

  return { ref, insertAtCursor, wrapSelection };
}
