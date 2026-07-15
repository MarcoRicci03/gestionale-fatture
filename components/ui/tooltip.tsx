"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <BaseTooltip.Provider>{children}</BaseTooltip.Provider>;
}

export function Tooltip({
  content,
  children,
  side = "top",
  sideOffset = 8,
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={sideOffset} align="center">
          <BaseTooltip.Popup
            className={cn(
              "z-50 rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
              "origin-[var(--transform-origin)] transition-[transform,opacity] duration-100 ease-out",
              "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
              "data-[ending-style]:opacity-0 data-[ending-style]:scale-95"
            )}
          >
            <BaseTooltip.Arrow
              className={cn(
                "block h-1.5 w-3 overflow-clip",
                "data-[side=bottom]:top-[-4px] data-[side=left]:right-[-8px] data-[side=left]:rotate-90",
                "data-[side=right]:left-[-8px] data-[side=right]:-rotate-90",
                "data-[side=top]:bottom-[-4px] data-[side=top]:rotate-180",
                "before:absolute before:bottom-0 before:left-1/2 before:h-2 before:w-2",
                "before:bg-popover before:border before:border-border",
                "before:[transform:translate(-50%,50%)_rotate(45deg)]"
              )}
            />
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
