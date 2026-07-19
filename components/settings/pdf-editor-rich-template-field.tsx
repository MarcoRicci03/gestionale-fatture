"use client";

import { EditorContent } from "@tiptap/react";
import { Bold, Italic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { RichTextDoc } from "@/lib/pdf/rich-text";
import { useRichBlockEditor, type RichBlockCommit } from "@/components/settings/use-rich-block-editor";
import { PLACEHOLDER_GROUPS, RIGA_MESE_GROUP, type PlaceholderGroup } from "@/lib/pdf/placeholder-catalog";

type RichTemplateFieldProps = {
  label: string;
  testo: string;
  richContent?: RichTextDoc;
  onCommit: (patch: RichBlockCommit) => void;
  extraGroups?: PlaceholderGroup[];
};

/**
 * Variante compatta (bordata, stile Textarea) dell'editor ricco, usata per i
 * template a riga singola del blocco "mesi" (descrizioneTemplate/valoreTemplate)
 * nella sidebar. Stessa infrastruttura di pdf-editor-rich-block.tsx (canvas),
 * riusata via useRichBlockEditor per evitare di duplicare la logica di commit.
 */
export function RichTemplateField({
  label,
  testo,
  richContent,
  onCommit,
  extraGroups = [],
}: RichTemplateFieldProps) {
  const editor = useRichBlockEditor({ testo, richContent, onCommit });

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="Grassetto"
        >
          <Bold className="mr-1 h-3.5 w-3.5" />
          Grassetto
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="Corsivo"
        >
          <Italic className="mr-1 h-3.5 w-3.5" />
          Corsivo
        </Button>
      </div>
      <EditorContent
        editor={editor}
        className={cn(
          "min-h-[2.5rem] rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs",
          "[&_.ProseMirror]:outline-none [&_.ProseMirror]:cursor-text",
          "[&_.ProseMirror_p]:m-0"
        )}
      />
      <div className="space-y-2">
        {[...extraGroups, ...PLACEHOLDER_GROUPS].map((group) => (
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
                  disabled={!editor}
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .insertVariable({ placeholder: item.value, label: item.label })
                      .run()
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
  );
}

export { RIGA_MESE_GROUP };
