import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function TemporaryPasswordNotice() {
  return (
    <div
      role="status"
      className="mb-6 flex items-center gap-2 rounded-lg border border-amber-600/30 bg-amber-600/10 px-3 py-2 text-sm text-amber-600"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Stai usando una password temporanea impostata da un amministratore.{" "}
        <Link href="/account" className="font-medium underline underline-offset-2">
          Cambiala dal tuo account
        </Link>
        .
      </span>
    </div>
  );
}
