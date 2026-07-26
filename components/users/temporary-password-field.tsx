"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateTemporaryPassword } from "@/lib/auth/generate-password";

// navigator.clipboard richiede un secure context (HTTPS o localhost): questo
// progetto oggi non ha TLS in produzione e next.config.ts contempla
// esplicitamente l'accesso via IP di LAN in sviluppo (allowedDevOrigins), dove
// la Clipboard API è undefined. Il fallback con una textarea temporanea +
// execCommand("copy") è deprecato ma è l'unica via percorribile senza secure
// context, ed evita che il bottone fallisca in silenzio.
async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Cade nel fallback sottostante.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

type TemporaryPasswordFieldProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  label?: string;
  /** Genera un valore iniziale al mount, invece di partire da un campo vuoto. */
  autoGenerate?: boolean;
};

export function TemporaryPasswordField({
  id = "password",
  value,
  onValueChange,
  error,
  label = "Password",
  autoGenerate = false,
}: TemporaryPasswordFieldProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  useEffect(() => {
    if (autoGenerate) {
      onValueChange(generateTemporaryPassword());
    }
    // Solo al mount: autoGenerate non deve rigenerare a ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = () => {
    onValueChange(generateTemporaryPassword());
    setCopyState("idle");
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    setCopyState(ok ? "copied" : "failed");
    setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          autoComplete="off"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          aria-invalid={!!error}
          className="min-w-0 flex-1 font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleGenerate}
          aria-label="Genera password casuale"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCopy}
          disabled={!value}
          aria-label="Copia password negli appunti"
        >
          {copyState === "copied" ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {copyState === "failed" && (
        <p className="text-sm text-destructive">
          Copia non riuscita: seleziona e copia manualmente il testo.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Password temporanea: l&apos;utente vedrà un avviso finché non la
        cambia dal proprio account.
      </p>
    </div>
  );
}
