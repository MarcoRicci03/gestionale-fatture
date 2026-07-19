"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildMockInvoice, renderMesiRows } from "@/lib/pdf/placeholders";
import { parseInlineFormatting } from "@/lib/pdf/formatting";
import { RichTemplateField, RIGA_MESE_GROUP } from "@/components/settings/pdf-editor-rich-template-field";
import type { MeseConfig } from "@/lib/pdf/types";

function PreviewSegments({ text }: { text: string }) {
  return (
    <>
      {parseInlineFormatting(text).map((segment, idx) => (
        <span
          key={idx}
          style={{
            fontWeight: segment.bold ? 700 : undefined,
            fontStyle: segment.italic ? "italic" : undefined,
            color: segment.gray ? "#9ca3af" : undefined,
          }}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}

type PdfEditorMesiPanelProps = {
  meseConfig: MeseConfig;
  onChange: (patch: Partial<MeseConfig>) => void;
};

export function PdfEditorMesiPanel({
  meseConfig,
  onChange,
}: PdfEditorMesiPanelProps) {
  const mockInvoice = useMemo(() => buildMockInvoice(), []);
  const previewRows = useMemo(
    () => renderMesiRows(meseConfig, mockInvoice),
    [meseConfig, mockInvoice]
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="mesi-titolo">Titolo (opzionale)</Label>
        <Input
          id="mesi-titolo"
          value={meseConfig.titolo ?? ""}
          onChange={(e) => onChange({ titolo: e.target.value })}
          placeholder="Es. Dettaglio mesi"
        />
      </div>

      <RichTemplateField
        label="Descrizione riga"
        testo={meseConfig.descrizioneTemplate}
        richContent={meseConfig.descrizioneRichContent}
        extraGroups={[RIGA_MESE_GROUP]}
        onCommit={(patch) =>
          onChange({
            descrizioneTemplate: patch.testo,
            descrizioneRichContent: patch.richContent,
          })
        }
      />

      <RichTemplateField
        label="Valore riga (a destra)"
        testo={meseConfig.valoreTemplate}
        richContent={meseConfig.valoreRichContent}
        extraGroups={[RIGA_MESE_GROUP]}
        onCommit={(patch) =>
          onChange({
            valoreTemplate: patch.testo,
            valoreRichContent: patch.richContent,
          })
        }
      />

      <div className="flex items-center justify-between rounded-md border p-2">
        <Label htmlFor="mostra-totale" className="text-sm">
          Mostra riga totale
        </Label>
        <Button
          id="mostra-totale"
          type="button"
          variant={meseConfig.mostraTotale ? "secondary" : "outline"}
          size="sm"
          onClick={() => onChange({ mostraTotale: !meseConfig.mostraTotale })}
        >
          {meseConfig.mostraTotale ? "Sì" : "No"}
        </Button>
      </div>

      {meseConfig.mostraTotale && (
        <div className="space-y-1">
          <Label htmlFor="totale-label">Etichetta totale</Label>
          <Input
            id="totale-label"
            value={meseConfig.totaleLabel ?? ""}
            onChange={(e) => onChange({ totaleLabel: e.target.value })}
            placeholder="Totale"
          />
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Anteprima
        </p>
        <div className="space-y-1 rounded-md border bg-muted/20 p-3 text-sm">
          {meseConfig.titolo && (
            <p className="font-bold">{meseConfig.titolo}</p>
          )}
          {previewRows.map((row, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2">
              <span>
                <PreviewSegments text={row.descrizione} />
              </span>
              <span>
                <PreviewSegments text={row.valore} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
