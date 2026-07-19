import { parseInlineFormatting } from "./formatting";
import { RIGA_MESE_GROUP, findPlaceholderLabel } from "./placeholder-catalog";

/**
 * Rappresentazione "ricca" del contenuto di un blocco, usata dall'editor WYSIWYG.
 * La forma è un sottoinsieme compatibile con il JSONContent di TipTap (stesso
 * shape prodotto da `editor.getJSON()`), così da poter passare `richContent`
 * direttamente a `editor.commands.setContent(...)` senza conversioni ulteriori.
 *
 * `Blocco.testo`/`MeseConfig.descrizioneTemplate`/`valoreTemplate` (stringa con
 * `{{...}}` e tag `<b>/<i>/<note>`) restano l'unica sorgente di verità per
 * `lib/pdf/placeholders.ts` e `invoice-pdf-document.tsx`, che NON leggono mai
 * `RichTextDoc` direttamente. Questo modulo fa solo da ponte bidirezionale.
 */

export type RichTextMarkType = "bold" | "italic" | "nota";

export type RichTextTextNode = {
  type: "text";
  text: string;
  marks?: { type: RichTextMarkType }[];
};

export type RichTextVariableNode = {
  type: "variable";
  attrs: { placeholder: string; label: string };
  marks?: { type: RichTextMarkType }[];
};

export type RichTextInlineNode = RichTextTextNode | RichTextVariableNode;

export type RichTextParagraphNode = {
  type: "paragraph";
  content?: RichTextInlineNode[];
};

export type RichTextDoc = {
  type: "doc";
  content: RichTextParagraphNode[];
};

const PLACEHOLDER_TOKEN_REGEX = /\{\{[^}]+\}\}/g;

const TAG_BY_MARK: Record<RichTextMarkType, "b" | "i" | "note"> = {
  bold: "b",
  italic: "i",
  nota: "note",
};

/** Ordine di precedenza quando un run di testo porta più marks contemporaneamente
 * (non dovrebbe accadere se lo schema editor li rende mutuamente esclusivi, ma
 * il formato legacy <b>/<i>/<note> non supporta nesting, quindi va risolto qui). */
const MARK_PRECEDENCE: RichTextMarkType[] = ["bold", "italic", "nota"];

function pickPrimaryMark(
  marks: { type: RichTextMarkType }[] | undefined
): RichTextMarkType | null {
  if (!marks || marks.length === 0) return null;
  const present = new Set(marks.map((m) => m.type));
  for (const candidate of MARK_PRECEDENCE) {
    if (present.has(candidate)) return candidate;
  }
  return null;
}

/** doc ricco -> stringa legacy `{{...}}` + `<b>/<i>/<note>`, per persistenza/generazione PDF. */
export function serializeRichContentToTesto(doc: RichTextDoc): string {
  return doc.content
    .map((paragraph) => serializeInlineNodes(paragraph.content ?? []))
    .join("\n");
}

function serializeInlineNodes(nodes: RichTextInlineNode[]): string {
  return nodes
    .map((node) => {
      const mark = pickPrimaryMark(node.marks);
      if (node.type === "variable") {
        if (!mark) return node.attrs.placeholder;
        const tag = TAG_BY_MARK[mark];
        return `<${tag}>${node.attrs.placeholder}</${tag}>`;
      }
      if (!mark) return node.text;
      const tag = TAG_BY_MARK[mark];
      return `<${tag}>${node.text}</${tag}>`;
    })
    .join("");
}

/** stringa legacy -> doc ricco, per idratare l'editor da layout già salvati (solo `testo`). */
export function parseTestoToRichContent(testo: string): RichTextDoc {
  const lines = testo.length > 0 ? testo.split("\n") : [""];
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: parseLineToInlineNodes(line),
    })),
  };
}

function parseLineToInlineNodes(line: string): RichTextInlineNode[] {
  if (line === "") return [];
  const segments = parseInlineFormatting(line);
  const nodes: RichTextInlineNode[] = [];

  for (const segment of segments) {
    const marks: { type: RichTextMarkType }[] = [];
    if (segment.bold) marks.push({ type: "bold" });
    if (segment.italic) marks.push({ type: "italic" });
    if (segment.gray) marks.push({ type: "nota" });

    nodes.push(...splitTextIntoVariableNodes(segment.text, marks));
  }

  return nodes;
}

function splitTextIntoVariableNodes(
  text: string,
  marks: { type: RichTextMarkType }[]
): RichTextInlineNode[] {
  const nodes: RichTextInlineNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(textNode(text.slice(lastIndex, match.index), marks));
    }
    const placeholder = match[0];
    nodes.push({
      type: "variable",
      attrs: {
        placeholder,
        label: findPlaceholderLabel(placeholder, [RIGA_MESE_GROUP]) ?? placeholder,
      },
      ...(marks.length > 0 ? { marks } : {}),
    });
    lastIndex = match.index + placeholder.length;
  }

  if (lastIndex < text.length) {
    nodes.push(textNode(text.slice(lastIndex), marks));
  }

  return nodes;
}

function textNode(
  text: string,
  marks: { type: RichTextMarkType }[]
): RichTextTextNode {
  return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}
