import { it, expect } from "vitest";
import { pdfSettingsSchema } from "../lib/validations/pdf-settings";

// fontFamily era z.string().min(1).max(100): qualunque stringa superava la
// validazione, ma getFontFamily (invoice-pdf-document.tsx) sa risolvere
// solo "Helvetica"/"Times-Roman"/"Courier" in un font PDF standard reale.
// Un valore diverso produceva un font non registrato in @react-pdf/renderer,
// che lancia in generazione — e l'effetto restava congelato in
// pdfLayoutSnapshot su ogni fattura creata da quel momento. L'editor non
// espone un controllo per questo campo: era raggiungibile solo chiamando
// updatePdfSettings direttamente (SEC-04).

const minimalBlocco = {
  id: "b1",
  tipo: "testo" as const,
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  fontSize: 11,
  align: "left" as const,
  visible: true,
};

it("rifiuta una fontFamily arbitraria", () => {
  const result = pdfSettingsSchema.safeParse({
    fontFamily: "Comic Sans",
    blocchi: [minimalBlocco],
  });
  expect(result.success).toBe(false);
});

it.each(["Helvetica", "Times-Roman", "Courier"])(
  "accetta fontFamily: %s",
  (fontFamily) => {
    const result = pdfSettingsSchema.safeParse({
      fontFamily,
      blocchi: [minimalBlocco],
    });
    expect(result.success).toBe(true);
  }
);

it("usa Helvetica come default se fontFamily è omessa", () => {
  const result = pdfSettingsSchema.safeParse({ blocchi: [minimalBlocco] });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.fontFamily).toBe("Helvetica");
  }
});
