"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE_OPTIONS } from "@/lib/utils/pagination";

type ListPaginationProps = {
  page: number;
  totalCount: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export function ListPagination({
  page,
  totalCount,
  pageSize,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  itemLabel,
  onPageChange,
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Se non c'è il cambio dimensione e c'è solo una pagina, o se totalCount è 0,
  // preserviamo il comportamento originario di non mostrare la barra.
  if (totalCount === 0 || (!onPageSizeChange && totalPages <= 1)) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <span>
          Pagina {page} di {totalPages} ({totalCount} {itemLabel})
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs sm:text-sm">
            <label
              htmlFor={`page-size-select-${itemLabel.replace(/\s+/g, "-")}`}
              className="text-muted-foreground whitespace-nowrap"
            >
              Elementi per pagina:
            </label>
            <select
              id={`page-size-select-${itemLabel.replace(/\s+/g, "-")}`}
              aria-label="Elementi per pagina"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs sm:text-sm font-medium shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Pagina precedente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Pagina successiva"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

