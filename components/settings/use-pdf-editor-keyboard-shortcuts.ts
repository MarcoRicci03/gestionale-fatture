"use client";

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { PAGE_W, PAGE_H, clamp } from "@/lib/pdf/canvas-geometry";
import type { Blocco, ImpostazioniPdf } from "@/lib/pdf/types";

function makeId() {
  return crypto.randomUUID();
}

type ClipboardState = { blocks: Blocco[]; isCut: boolean } | null;

type UsePdfEditorKeyboardShortcutsOptions = {
  blocchi: Blocco[];
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  clipboard: ClipboardState;
  setClipboard: Dispatch<SetStateAction<ClipboardState>>;
  pasteCountRef: RefObject<number>;
  isMouseOverCanvas: RefObject<boolean>;
  removeBlock: (id: string) => void;
  undo: () => void;
  redo: () => void;
  pushSettings: (next: ImpostazioniPdf | ((prev: ImpostazioniPdf) => ImpostazioniPdf)) => void;
  setAutoFit: Dispatch<SetStateAction<boolean>>;
  setZoom: Dispatch<SetStateAction<number>>;
};

export function usePdfEditorKeyboardShortcuts({
  blocchi,
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
}: UsePdfEditorKeyboardShortcutsOptions) {
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
          if (prev.size === blocchi.length) return new Set();
          return new Set(blocchi.map((b) => b.id));
        });
      } else if ((e.key === "c" || e.key === "C") && selectedIds.size > 0) {
        e.preventDefault();
        const blocks = blocchi.filter((b) => selectedIds.has(b.id));
        setClipboard({ blocks: blocks.map((b) => ({ ...b })), isCut: false });
        pasteCountRef.current = 0;
      } else if ((e.key === "x" || e.key === "X") && selectedIds.size > 0) {
        e.preventDefault();
        const blocks = blocchi.filter((b) => selectedIds.has(b.id));
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
    blocchi,
    selectedIds,
    clipboard,
    removeBlock,
    undo,
    redo,
    pushSettings,
    setSelectedIds,
    setClipboard,
    pasteCountRef,
    isMouseOverCanvas,
    setAutoFit,
    setZoom,
  ]);
}
