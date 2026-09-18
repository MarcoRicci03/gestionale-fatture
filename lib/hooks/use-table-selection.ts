"use client";

import { useEffect, useRef, useState } from "react";

type UseTableSelectionOptions<T extends string | number> = {
  items: { id: T }[];
};

export function useTableSelection<T extends string | number>({
  items,
}: UseTableSelectionOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const selectedInView = items.filter((item) => selectedIds.has(item.id)).length;
    selectAllRef.current.indeterminate =
      selectedInView > 0 && selectedInView < items.length;
  }, [selectedIds, items]);

  const toggleSelected = (id: T, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        items.forEach((item) => next.add(item.id));
      } else {
        items.forEach((item) => next.delete(item.id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return {
    selectedIds,
    selectAllRef,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    setSelectedIds,
  };
}
