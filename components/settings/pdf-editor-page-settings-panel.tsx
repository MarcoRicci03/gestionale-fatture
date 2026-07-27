"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clamp, toNumber } from "@/lib/pdf/canvas-geometry";

type PdfEditorPageSettingsPanelProps = {
  open: boolean;
  onToggleOpen: () => void;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  onChangeMargins: (patch: {
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
  }) => void;
};

export function PdfEditorPageSettingsPanel({
  open,
  onToggleOpen,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  onChangeMargins,
}: PdfEditorPageSettingsPanelProps) {
  return (
    <div className="rounded-lg border p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-medium"
        onClick={onToggleOpen}
      >
        <span>Impostazioni pagina</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Margini foglio
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="marginTop">Alto</Label>
              <Input
                id="marginTop"
                type="number"
                min={0}
                max={400}
                value={marginTop}
                onChange={(e) =>
                  onChangeMargins({ marginTop: clamp(toNumber(e.target.value), 0, 400) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="marginRight">Destra</Label>
              <Input
                id="marginRight"
                type="number"
                min={0}
                max={400}
                value={marginRight}
                onChange={(e) =>
                  onChangeMargins({ marginRight: clamp(toNumber(e.target.value), 0, 400) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="marginBottom">Basso</Label>
              <Input
                id="marginBottom"
                type="number"
                min={0}
                max={400}
                value={marginBottom}
                onChange={(e) =>
                  onChangeMargins({ marginBottom: clamp(toNumber(e.target.value), 0, 400) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="marginLeft">Sinistra</Label>
              <Input
                id="marginLeft"
                type="number"
                min={0}
                max={400}
                value={marginLeft}
                onChange={(e) =>
                  onChangeMargins({ marginLeft: clamp(toNumber(e.target.value), 0, 400) })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
