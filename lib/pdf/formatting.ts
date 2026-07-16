export type TextSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  gray?: boolean;
};

const FORMATTING_REGEX = /<(b|i|note)>([^<]*)<\/\1>/g;

export function parseInlineFormatting(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FORMATTING_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    const tag = match[1];
    const content = match[2];
    segments.push({
      text: content,
      bold: tag === "b",
      italic: tag === "i",
      gray: tag === "note",
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}
