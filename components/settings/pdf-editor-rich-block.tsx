"use client";

import { EditorContent, type Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import type { RichTextDoc } from "@/lib/pdf/rich-text";
import { useRichBlockEditor, type RichBlockCommit } from "@/components/settings/use-rich-block-editor";

export type { RichBlockCommit };

type RichTextBlockEditorProps = {
  testo: string;
  richContent?: RichTextDoc;
  onCommit: (patch: RichBlockCommit) => void;
  onEditorReady: (editor: Editor | null) => void;
  onExit: () => void;
  className?: string;
};

export function RichTextBlockEditor({
  testo,
  richContent,
  onCommit,
  onEditorReady,
  onExit,
  className,
}: RichTextBlockEditorProps) {
  const editor = useRichBlockEditor({ testo, richContent, onCommit, onEditorReady, onExit });

  return (
    <EditorContent
      editor={editor}
      className={cn(
        "h-full w-full",
        "[&_.ProseMirror]:h-full [&_.ProseMirror]:w-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:cursor-text",
        "[&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:break-words",
        "[&_.ProseMirror_p]:m-0",
        className
      )}
    />
  );
}
