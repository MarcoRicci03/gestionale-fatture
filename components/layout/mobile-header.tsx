"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Session } from "@/lib/auth/session";
import { Tooltip } from "@/components/ui/tooltip";
import { SidebarContent } from "./sidebar-content";

type MobileHeaderProps = {
  session: Session;
};

export function MobileHeader({ session }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background px-4 py-3 lg:hidden">
      <span className="font-heading text-lg font-semibold">Logopedista</span>
      <Sheet>
        <SheetTrigger
          render={
            <Tooltip content="Apri menu">
              <Button variant="ghost" size="icon" aria-label="Apri menu" />
            </Tooltip>
          }
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 pt-6 text-left">
            <SheetTitle>Logopedista</SheetTitle>
            <SheetDescription className="sr-only">
              Navigazione principale
            </SheetDescription>
          </SheetHeader>
          <div className="flex h-[calc(100%-5rem)] flex-col px-4 py-4">
            <SidebarContent session={session} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
