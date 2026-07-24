export type TextSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  gray?: boolean;
};

// La regex ha flag `g` ed è a livello di modulo, ma viene usata con
// `text.matchAll(...)`, che per spec ne costruisce internamente una copia — il
// `lastIndex` di questa costante NON viene mai mutato. Così lo stato non è
// condiviso tra chiamate (parseInlineFormatting è invocata molte volte per
// render) e resta corretto anche se un domani si aggiunge un break/return nel
// ciclo. NON riconvertire a `.exec()` in un while: reintrodurrebbe il bug.
const FORMATTING_REGEX = /<(b|i|note)>([^<]*)<\/\1>/g;

export function parseInlineFormatting(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(FORMATTING_REGEX)) {
    const index = match.index;
    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index) });
    }

    const tag = match[1];
    const content = match[2];
    segments.push({
      text: content,
      bold: tag === "b",
      italic: tag === "i",
      gray: tag === "note",
    });

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}
