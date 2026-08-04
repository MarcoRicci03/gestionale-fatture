"use client";

import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Italic,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_W, PAGE_H, clamp, toNumber } from "@/lib/pdf/canvas-geometry";
import { PRESETS, DEFAULT_MESE_CONFIG } from "@/components/settings/pdf-editor-presets";
import { PdfEditorMesiPanel } from "@/components/settings/pdf-editor-mesi-panel";
import { PLACEHOLDER_GROUPS } from "@/lib/pdf/placeholder-catalog";
import type { Blocco } from "@/lib/pdf/types";

type PdfEditorBlockPropertiesPanelProps = {
  selectedBlock: Blocco;
  advancedMode: boolean;
  onToggleAdvancedMode: () => void;
  activeEditor: Editor | null;
  testoRef: RefObject<HTMLTextAreaElement | null>;
  wrapText: (prefix: string, suffix: string) => void;
  insertPlaceholder: (value: string) => void;
  insertPlaceholderChip: (value: string, label: string) => void;
  toggleRichBold: () => void;
  toggleRichItalic: () => void;
  toggleRichNota: () => void;
  updateBlock: (id: string, patch: Partial<Blocco>) => void;
  moveOrder: (id: string, direction: -1 | 1) => void;
  duplicateBlock: (id: string) => void;
  removeBlock: (id: string) => void;
};

export function PdfEditorBlockPropertiesPanel({
  selectedBlock,
  advancedMode,
  onToggleAdvancedMode,
  activeEditor,
  testoRef,
  wrapText,
  insertPlaceholder,
  insertPlaceholderChip,
  toggleRichBold,
  toggleRichItalic,
  toggleRichNota,
  updateBlock,
  moveOrder,
  duplicateBlock,
  removeBlock,
}: PdfEditorBlockPropertiesPanelProps) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{PRESETS[selectedBlock.tipo].label}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => moveOrder(selectedBlock.id, -1)}
            title="Porta avanti"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => moveOrder(selectedBlock.id, 1)}
            title="Porta indietro"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => duplicateBlock(selectedBlock.id)}
            title="Duplica"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              updateBlock(selectedBlock.id, { visible: !selectedBlock.visible })
            }
            title={selectedBlock.visible ? "Nascondi" : "Mostra"}
          >
            {selectedBlock.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => removeBlock(selectedBlock.id)}
            title="Elimina"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedBlock.tipo === "mesi" ? (
        <PdfEditorMesiPanel
          meseConfig={selectedBlock.meseConfig ?? DEFAULT_MESE_CONFIG}
          onChange={(patch) =>
            updateBlock(selectedBlock.id, {
              meseConfig: {
                ...(selectedBlock.meseConfig ?? DEFAULT_MESE_CONFIG),
                ...patch,
              },
            })
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Contenuto</Label>
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={onToggleAdvancedMode}
            >
              <Code2 className="h-3 w-3" />
              {advancedMode ? "Modalità semplice" : "Modalità avanzata"}
            </button>
          </div>

          {advancedMode ? (
            <>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => wrapText("<b>", "</b>")}
                  title="Grassetto"
                >
                  <Bold className="mr-1 h-3.5 w-3.5" />
                  Grassetto
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => wrapText("<i>", "</i>")}
                  title="Corsivo"
                >
                  <Italic className="mr-1 h-3.5 w-3.5" />
                  Corsivo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => wrapText("<note>", "</note>")}
                  title="Nota grigia"
                >
                  Nota
                </Button>
              </div>
              <Textarea
                ref={testoRef}
                id="testo"
                rows={5}
                value={selectedBlock.testo ?? ""}
                onChange={(e) =>
                  updateBlock(selectedBlock.id, {
                    testo: e.target.value,
                    richContent: undefined,
                  })
                }
              />
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant={activeEditor?.isActive("bold") ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!activeEditor}
                  onClick={toggleRichBold}
                  title="Grassetto"
                >
                  <Bold className="mr-1 h-3.5 w-3.5" />
                  Grassetto
                </Button>
                <Button
                  variant={activeEditor?.isActive("italic") ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!activeEditor}
                  onClick={toggleRichItalic}
                  title="Corsivo"
                >
                  <Italic className="mr-1 h-3.5 w-3.5" />
                  Corsivo
                </Button>
                <Button
                  variant={activeEditor?.isActive("nota") ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!activeEditor}
                  onClick={toggleRichNota}
                  title="Nota grigia"
                >
                  Nota
                </Button>
              </div>
              {!activeEditor && (
                <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                  Fai doppio clic sul blocco nel foglio per modificarne il testo.
                </p>
              )}
            </>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Inserisci valore dinamico
            </p>
            <div className="space-y-2">
              {PLACEHOLDER_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] uppercase text-muted-foreground">{group.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.items.map((item) => (
                      <Button
                        key={item.value}
                        variant="secondary"
                        size="sm"
                        className="h-6 text-xs"
                        disabled={!advancedMode && !activeEditor}
                        onClick={() =>
                          advancedMode
                            ? insertPlaceholder(item.value)
                            : insertPlaceholderChip(item.value, item.label)
                        }
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="x">X</Label>
          <Input
            id="x"
            type="number"
            min={0}
            max={PAGE_W}
            value={selectedBlock.x}
            onChange={(e) =>
              updateBlock(selectedBlock.id, { x: clamp(toNumber(e.target.value), 0, PAGE_W) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="y">Y</Label>
          <Input
            id="y"
            type="number"
            min={0}
            max={PAGE_H}
            value={selectedBlock.y}
            onChange={(e) =>
              updateBlock(selectedBlock.id, { y: clamp(toNumber(e.target.value), 0, PAGE_H) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="w">Larghezza</Label>
          <Input
            id="w"
            type="number"
            min={10}
            max={PAGE_W}
            value={selectedBlock.width}
            onChange={(e) =>
              updateBlock(selectedBlock.id, { width: clamp(toNumber(e.target.value), 10, PAGE_W) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="h">Altezza</Label>
          <Input
            id="h"
            type="number"
            min={10}
            max={PAGE_H}
            value={selectedBlock.height}
            onChange={(e) =>
              updateBlock(selectedBlock.id, { height: clamp(toNumber(e.target.value), 10, PAGE_H) })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fontSize">Dimensione font</Label>
          <Input
            id="fontSize"
            type="number"
            min={6}
            max={72}
            value={selectedBlock.fontSize}
            onChange={(e) =>
              updateBlock(selectedBlock.id, { fontSize: clamp(toNumber(e.target.value), 6, 72) })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lineHeight">Interlinea</Label>
          <Input
            id="lineHeight"
            type="number"
            min={0.5}
            max={3}
            step={0.05}
            value={selectedBlock.lineHeight ?? 1}
            onChange={(e) =>
              updateBlock(selectedBlock.id, {
                lineHeight: clamp(toNumber(e.target.value), 0.5, 3),
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Padding blocco</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="paddingTop" className="text-xs text-muted-foreground">Alto</Label>
            <Input
              id="paddingTop"
              type="number"
              min={0}
              max={100}
              value={selectedBlock.paddingTop ?? 0}
              onChange={(e) =>
                updateBlock(selectedBlock.id, {
                  paddingTop: clamp(toNumber(e.target.value), 0, 100),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="paddingRight" className="text-xs text-muted-foreground">Destra</Label>
            <Input
              id="paddingRight"
              type="number"
              min={0}
              max={100}
              value={selectedBlock.paddingRight ?? 0}
              onChange={(e) =>
                updateBlock(selectedBlock.id, {
                  paddingRight: clamp(toNumber(e.target.value), 0, 100),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="paddingBottom" className="text-xs text-muted-foreground">Basso</Label>
            <Input
              id="paddingBottom"
              type="number"
              min={0}
              max={100}
              value={selectedBlock.paddingBottom ?? 0}
              onChange={(e) =>
                updateBlock(selectedBlock.id, {
                  paddingBottom: clamp(toNumber(e.target.value), 0, 100),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="paddingLeft" className="text-xs text-muted-foreground">Sinistra</Label>
            <Input
              id="paddingLeft"
              type="number"
              min={0}
              max={100}
              value={selectedBlock.paddingLeft ?? 0}
              onChange={(e) =>
                updateBlock(selectedBlock.id, {
                  paddingLeft: clamp(toNumber(e.target.value), 0, 100),
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="align">Allineamento</Label>
        <Select
          value={selectedBlock.align}
          onValueChange={(v) => updateBlock(selectedBlock.id, { align: v as Blocco["align"] })}
        >
          <SelectTrigger id="align" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Sinistra</SelectItem>
            <SelectItem value="center">Centro</SelectItem>
            <SelectItem value="right">Destra</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
