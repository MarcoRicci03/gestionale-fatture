"use client";

import { useCallback, useMemo, useRef } from "react";
import { Bold, Italic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildMockInvoice, renderMesiRows } from "@/lib/pdf/placeholders";
import { parseInlineFormatting } from "@/lib/pdf/formatting";
import { PLACEHOLDER_GROUPS } from "@/components/settings/pdf-editor";
import type { MeseConfig } from "@/lib/pdf/types";

const RIGA_MESE_GROUP = {
  label: "Riga mese",
  items: [
    { label: "Nome mese", value: "{{riga.meseLabel}}" },
    { label: "Mese (maiuscolo)", value: "{{riga.mese}}" },
    { label: "Prezzo", value: "{{riga.prezzo}}" },
    { label: "Prezzo (numero)", value: "{{riga.prezzoNumero}}" },
  ],
};

function TemplateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = useCallback(
    (insert: string) => {
      const el = ref.current;
      if (!el) {
        onChange(value + insert);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + insert + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + insert.length;
      });
    },
    [value, onChange]
  );

  const wrap = useCallback(
    (prefix: string, suffix: string) => {
      const el = ref.current;
      if (!el) {
        onChange(prefix + value + suffix);
        return;
      }
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const before = value.slice(0, start);
      const selected = value.slice(start, end);
      const after = value.slice(end);
      const newStart = start + prefix.length;
      const newEnd = end + prefix.length;
      onChange(before + prefix + selected + suffix + after);
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = newStart;
        el.selectionEnd = newEnd;
      });
    },
    [value, onChange]
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => wrap("<b>", "</b>")}
          title="Grassetto"
        >
          <Bold className="mr-1 h-3.5 w-3.5" />
          Grassetto
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => wrap("<i>", "</i>")}
          title="Corsivo"
        >
          <Italic className="mr-1 h-3.5 w-3.5" />
          Corsivo
        </Button>
      </div>
      <Textarea
        ref={ref}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="space-y-2">
        {[RIGA_MESE_GROUP, ...PLACEHOLDER_GROUPS].map((group) => (
          <div key={group.label}>
            <p className="text-[10px] uppercase text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {group.items.map((item) => (
                <Button
                  key={item.value}
                  variant="secondary"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => insertAtCursor(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

      <TemplateField
        label="Descrizione riga"
        value={meseConfig.descrizioneTemplate}
        onChange={(next) => onChange({ descrizioneTemplate: next })}
      />

      <TemplateField
        label="Valore riga (a destra)"
        value={meseConfig.valoreTemplate}
        onChange={(next) => onChange({ valoreTemplate: next })}
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
