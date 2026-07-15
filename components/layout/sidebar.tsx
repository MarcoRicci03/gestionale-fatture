import type { Session } from "@/lib/auth/session";
import { SidebarContent } from "./sidebar-content";

type SidebarProps = {
  session: Session;
};

export function Sidebar({ session }: SidebarProps) {
  return (
    <aside className="hidden lg:flex h-screen w-64 flex-col border-r bg-sidebar px-4 py-6">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          S
        </div>
        <span className="font-heading text-lg font-semibold text-sidebar-foreground">
          Logopedista
        </span>
      </div>

      <SidebarContent session={session} />
    </aside>
  );
}
