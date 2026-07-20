"use client";

import { useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Session } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SidebarContent } from "./sidebar-content";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

type SidebarProps = {
  session: Session;
};

export function Sidebar({ session }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isFirstRun = useRef(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") {
      // Sync collapsed state from a persisted preference on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "hidden lg:flex h-screen flex-col border-r bg-sidebar py-6 transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16 px-2" : "w-64 px-4"
      )}
    >
      <div
        className={cn(
          "mb-8 flex items-center px-2",
          collapsed ? "flex-col gap-3" : "justify-between gap-3"
        )}
      >
        <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            S
          </div>
          {!collapsed && (
            <span className="font-heading text-lg font-semibold text-sidebar-foreground">
              {session.specializzazione || "Gestionale"}
            </span>
          )}
        </div>

        <Tooltip content={collapsed ? "Espandi menu" : "Comprimi menu"}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Espandi menu" : "Comprimi menu"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>
        </Tooltip>
      </div>

      <SidebarContent session={session} collapsed={collapsed} />
    </aside>
  );
}
