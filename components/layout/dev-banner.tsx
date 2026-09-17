import { AlertTriangle } from "lucide-react";

export function DevBanner() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <aside
      role="status"
      aria-label="Avviso ambiente di sviluppo"
      className="shrink-0 z-50 flex items-center justify-center gap-2 border-b border-amber-600/30 bg-amber-500 px-3 py-1 text-xs font-medium tracking-wide text-amber-950 select-none shadow-xs dark:bg-amber-600 dark:text-amber-50"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        <strong className="font-semibold uppercase">Ambiente di Sviluppo (DEV)</strong>
        <span className="hidden sm:inline">
          {" "}— I dati e le comunicazioni Sistema TS sono a scopo di test e non hanno valore fiscale
        </span>
      </span>
    </aside>
  );
}
