import { describe, it, expect } from "vitest";
import { parseInlineFormatting } from "./formatting";

// Regressione LOG-13 in SECURITY_AUDIT.md. parseInlineFormatting usa una regex
// `g` a livello di modulo: questi test comportamentali coprono la segmentazione
// e, soprattutto, verificano che chiamate consecutive non condividano stato
// (bug che si presenterebbe se si tornasse a `.exec()` in un while con la regex
// condivisa e un'uscita anticipata dal ciclo).

describe("parseInlineFormatting", () => {
  it("restituisce un solo segmento di testo semplice senza tag", () => {
    expect(parseInlineFormatting("Ciao mondo")).toEqual([
      { text: "Ciao mondo" },
    ]);
  });

  it("segmenta un singolo tag con testo prima e dopo", () => {
    expect(parseInlineFormatting("prima <b>grassetto</b> dopo")).toEqual([
      { text: "prima " },
      { text: "grassetto", bold: true, italic: false, gray: false },
      { text: " dopo" },
    ]);
  });

  it("riconosce i tre tipi di tag b/i/note", () => {
    expect(parseInlineFormatting("<b>B</b><i>I</i><note>N</note>")).toEqual([
      { text: "B", bold: true, italic: false, gray: false },
      { text: "I", bold: false, italic: true, gray: false },
      { text: "N", bold: false, italic: false, gray: true },
    ]);
  });

  it("gestisce più tag intervallati da testo", () => {
    expect(
      parseInlineFormatting("a <b>uno</b> b <i>due</i> c")
    ).toEqual([
      { text: "a " },
      { text: "uno", bold: true, italic: false, gray: false },
      { text: " b " },
      { text: "due", bold: false, italic: true, gray: false },
      { text: " c" },
    ]);
  });

  it("restituisce array vuoto per stringa vuota", () => {
    expect(parseInlineFormatting("")).toEqual([]);
  });

  it("non condivide stato tra chiamate consecutive con input diversi", () => {
    // Prima chiamata: consuma un match e porta la regex a lastIndex > 0 se lo
    // stato fosse condiviso (col vecchio pattern .exec()).
    const first = parseInlineFormatting("<b>x</b> resto");
    // Seconda chiamata su un input più corto: se lastIndex fosse rimasto dalla
    // chiamata precedente, il primo match verrebbe saltato.
    const second = parseInlineFormatting("<i>y</i>");
    expect(first).toEqual([
      { text: "x", bold: true, italic: false, gray: false },
      { text: " resto" },
    ]);
    expect(second).toEqual([
      { text: "y", bold: false, italic: true, gray: false },
    ]);
  });

  it("è idempotente: stesso input → stesso output su chiamate ripetute", () => {
    const input = "<b>a</b><i>b</i><note>c</note>";
    expect(parseInlineFormatting(input)).toEqual(parseInlineFormatting(input));
  });
});
