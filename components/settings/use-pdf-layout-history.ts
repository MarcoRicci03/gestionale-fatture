"use client";

import { useCallback, useState } from "react";
import type { ImpostazioniPdf } from "@/lib/pdf/types";

const MAX_HISTORY_LENGTH = 50;

type UsePdfLayoutHistoryOptions = {
  initialSettings: ImpostazioniPdf;
  onNavigate?: (nextSettings: ImpostazioniPdf) => void;
};

export function usePdfLayoutHistory({ initialSettings, onNavigate }: UsePdfLayoutHistoryOptions) {
  const [editorState, setEditorState] = useState<{
    history: ImpostazioniPdf[];
    index: number;
  }>({
    history: [initialSettings],
    index: 0,
  });
  const settings = editorState.history[editorState.index];

  const pushSettings = useCallback(
    (next: ImpostazioniPdf | ((prev: ImpostazioniPdf) => ImpostazioniPdf)) => {
      setEditorState((state) => {
        const current = state.history[state.index];
        const resolved =
          typeof next === "function"
            ? (next as (prev: ImpostazioniPdf) => ImpostazioniPdf)(current)
            : next;
        if (resolved === current) return state;
        let nextHistory = [...state.history.slice(0, state.index + 1), resolved];
        let nextIndex = state.index + 1;
        if (nextHistory.length > MAX_HISTORY_LENGTH) {
          const overflow = nextHistory.length - MAX_HISTORY_LENGTH;
          nextHistory = nextHistory.slice(overflow);
          nextIndex -= overflow;
        }
        return { history: nextHistory, index: nextIndex };
      });
    },
    []
  );

  const undo = useCallback(() => {
    if (editorState.index <= 0) return;
    const nextIndex = editorState.index - 1;
    setEditorState({ ...editorState, index: nextIndex });
    onNavigate?.(editorState.history[nextIndex]);
  }, [editorState, onNavigate]);

  const redo = useCallback(() => {
    if (editorState.index >= editorState.history.length - 1) return;
    const nextIndex = editorState.index + 1;
    setEditorState({ ...editorState, index: nextIndex });
    onNavigate?.(editorState.history[nextIndex]);
  }, [editorState, onNavigate]);

  const canUndo = editorState.index > 0;
  const canRedo = editorState.index < editorState.history.length - 1;

  return { settings, pushSettings, undo, redo, canUndo, canRedo };
}
