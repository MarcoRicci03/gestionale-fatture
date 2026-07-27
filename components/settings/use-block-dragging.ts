"use client";

import { useCallback, useState } from "react";
import { computeSnap, type GuideLines } from "@/lib/pdf/canvas-geometry";
import type { Blocco } from "@/lib/pdf/types";

type DraggingState = { id: string; x: number; y: number };

type UseBlockDraggingOptions = {
  blocchi: Blocco[];
  updateBlock: (id: string, patch: Partial<Blocco>) => void;
  onDragStart?: (id: string) => void;
};

export function useBlockDragging({ blocchi, updateBlock, onDragStart }: UseBlockDraggingOptions) {
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [guides, setGuides] = useState<GuideLines>({});

  const handleDragStart = useCallback(
    (id: string) => {
      const block = blocchi.find((b) => b.id === id);
      if (!block) return;
      setDragging({ id, x: block.x, y: block.y });
      setGuides({});
      onDragStart?.(id);
    },
    [blocchi, onDragStart]
  );

  const handleDrag = useCallback(
    (id: string, x: number, y: number) => {
      const block = blocchi.find((b) => b.id === id);
      if (!block) return;
      const others = blocchi.filter((b) => b.id !== id);
      const snapped = computeSnap(block, x, y, others);
      setDragging({ id, x: snapped.x, y: snapped.y });
      setGuides(snapped.guides);
    },
    [blocchi]
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

  return { dragging, guides, handleDragStart, handleDrag, handleDragStop };
}
