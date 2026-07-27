import type { Blocco } from "./types";

export const PAGE_W = 595;
export const PAGE_H = 842;
export const SNAP_THRESHOLD = 8;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function toNumber(value: string): number {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

export type GuideLines = { x?: number; y?: number };

export function computeSnap(
  dragged: Blocco,
  x: number,
  y: number,
  others: Blocco[]
): { x: number; y: number; guides: GuideLines } {
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
    const otherLinesX = [other.x, other.x + other.width / 2, other.x + other.width];
    const otherLinesY = [other.y, other.y + other.height / 2, other.y + other.height];

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
}
