import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SelectionFloatingBarProps {
  count: number;
  countLabel?: string;
  totalLabel?: string;
  onClear?: () => void;
  clearLabel?: string;
  children?: ReactNode;
  className?: string;
}

export function SelectionFloatingBar({
  count,
  countLabel,
  totalLabel,
  onClear,
  clearLabel = "Deseleziona tutti",
  children,
  className,
}: SelectionFloatingBarProps) {
  if (count <= 0) return null;

  return (
    <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-4 w-full">
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-4 rounded-xl border border-primary/20 bg-card/95 px-4 py-2.5 text-sm text-foreground shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2",
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex shrink-0 items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {count} {countLabel ?? (count === 1 ? "selezionato" : "selezionati")}
          </span>
          {totalLabel && (
            <span className="truncate text-xs text-muted-foreground sm:text-sm">
              {totalLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {children}
          {onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              {clearLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
