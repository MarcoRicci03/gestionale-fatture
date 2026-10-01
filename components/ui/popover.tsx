"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverPortal({ ...props }: PopoverPrimitive.Portal.Props) {
  return <PopoverPrimitive.Portal data-slot="popover-portal" {...props} />;
}

function PopoverContent({
  className,
  positionerClassName,
  align = "center",
  sideOffset = 6,
  side = "top",
  showArrow = true,
  children,
  ...props
}: PopoverPrimitive.Popup.Props & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
  side?: "top" | "bottom" | "left" | "right";
  showArrow?: boolean;
  positionerClassName?: string;
}) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className={cn("isolate z-50", positionerClassName)}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "relative z-50 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none",
            "origin-[var(--transform-origin)] transition-[transform,opacity] duration-100 ease-out",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className
          )}
          {...props}
        >
          {showArrow && (
            <PopoverPrimitive.Arrow
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
          )}
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPortal>
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverPortal };
