"use client";

import { Button } from "@/components/ui/button";
import { PRESETS } from "@/components/settings/pdf-editor-presets";
import type { TipoBlocco } from "@/lib/pdf/types";

type PdfEditorAddBlockPanelProps = {
  previewMode: boolean;
  onAddBlock: (tipo: TipoBlocco) => void;
};

export function PdfEditorAddBlockPanel({ previewMode, onAddBlock }: PdfEditorAddBlockPanelProps) {
  return (
    <div className="order-2 flex flex-col gap-2 lg:order-1 lg:w-44 lg:max-h-full lg:overflow-auto">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        Aggiungi blocco
      </p>
      {(Object.keys(PRESETS) as TipoBlocco[]).map((tipo) => {
        const Icon = PRESETS[tipo].icon;
        return (
          <Button
            key={tipo}
            variant="outline"
            className="justify-start"
            size="sm"
            onClick={() => onAddBlock(tipo)}
            disabled={previewMode}
          >
            <Icon className="mr-2 h-4 w-4" />
            {PRESETS[tipo].label}
          </Button>
        );
      })}

      <div className="mt-4 rounded-md border p-3 text-xs text-muted-foreground">
        <p className="mb-2 font-semibold uppercase">Comandi rapidi</p>
        <div className="space-y-1">
          <p>
            <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
            <span className="rounded border px-1 font-mono">A</span> — Seleziona tutti
          </p>
          <p>
            <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
            <span className="rounded border px-1 font-mono">+</span> — Zoom avanti
          </p>
          <p>
            <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
            <span className="rounded border px-1 font-mono">-</span> — Zoom indietro
          </p>
          <p>
            <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
            <span className="rounded border px-1 font-mono">Z</span> — Annulla
          </p>
          <p>
            <span className="rounded border px-1 font-mono">Tasto</span> +{" "}
            <span className="rounded border px-1 font-mono">centrale</span> — Pan
          </p>
          <p>
            <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
            <span className="rounded border px-1 font-mono">C</span> — Copia
          </p>
          <p>
            <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
            <span className="rounded border px-1 font-mono">X</span> — Taglia
          </p>
          <p>
            <span className="rounded border px-1 font-mono">Ctrl</span> +{" "}
            <span className="rounded border px-1 font-mono">V</span> — Incolla
          </p>
          <p>
            <span className="rounded border px-1 font-mono">Canc</span> — Elimina
          </p>
        </div>
      </div>
    </div>
  );
}
