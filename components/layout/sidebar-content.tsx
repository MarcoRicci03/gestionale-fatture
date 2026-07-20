"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileText,
  Settings,
  UserCircle,
  FileType,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/auth/session";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  admin?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Pazienti", icon: Users },
  { href: "/payers", label: "Paganti", icon: UserCheck },
  { href: "/invoices", label: "Fatture", icon: FileText },
  { href: "/users", label: "Utenti", icon: Settings, admin: true },
];

type SidebarContentProps = {
  session: Session;
  collapsed?: boolean;
};

export function SidebarContent({ session, collapsed = false }: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 flex flex-col gap-1 overflow-auto">
        {navItems
          .filter((item) => !item.admin || session.isAdmin)
          .map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center gap-0 px-2",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
            </Link>
            );
          })}
      </nav>

      <div className="mt-4 space-y-3 border-t border-sidebar-border pt-4">
        <Link
          href="/settings/pdf"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            collapsed && "justify-center gap-0 px-2",
            pathname === "/settings/pdf" || pathname.startsWith("/settings/")
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <FileType className="h-5 w-5 shrink-0" />
          <div className={cn("flex flex-col", collapsed && "sr-only")}>
            <span className="leading-none">Impostazioni PDF</span>
          </div>
        </Link>

        <Link
          href="/account"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            collapsed && "justify-center gap-0 px-2",
            pathname === "/account" || pathname.startsWith("/account/")
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <UserCircle className="h-5 w-5 shrink-0" />
          <div className={cn("flex flex-col", collapsed && "sr-only")}>
            <span className="leading-none">
              {[session.nome, session.cognome].filter(Boolean).join(" ") ||
                session.username}
            </span>
            {session.isAdmin && (
              <span className="mt-1 text-[10px] uppercase tracking-wider text-sidebar-primary-foreground/80">
                Admin
              </span>
            )}
          </div>
        </Link>

        <form action={logout}>
          <Button
            type="submit"
            variant="outline"
            className={collapsed ? "w-auto mx-auto" : "w-full"}
            aria-label="Logout"
          >
            {collapsed && <LogOut className="h-4 w-4" />}
            <span className={collapsed ? "sr-only" : undefined}>Logout</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
