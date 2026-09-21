import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { InvoicePDFDocument } from "./invoice-pdf-document";
import { buildMockInvoice } from "@/lib/pdf/placeholders";
import { LAYOUT_DEFAULT } from "@/lib/pdf/layout-default";
import type { PdfLayout } from "@/lib/pdf/types";

describe("InvoicePDFDocument", () => {
  it("genera correttamente lo stream PDF per una fattura con blocco mesi", async () => {
    const invoice = buildMockInvoice();
    const stream = (await renderToStream(
      <InvoicePDFDocument invoice={invoice} settings={LAYOUT_DEFAULT} />
    )) as AsyncIterable<Buffer>;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("genera lo stream PDF senza errori anche con descrizione mese molto lunga che va a capo", async () => {
    const baseMock = buildMockInvoice();
    const invoice = {
      ...baseMock,
      paziente: {
        ...baseMock.paziente!,
        nome: "Mario",
        cognome: "Mooolto Lungooooo Con Nome Lunghissimo Per Testare Il Wrapping",
      },
    };

    const customLayout: PdfLayout = {
      ...LAYOUT_DEFAULT,
      blocchi: LAYOUT_DEFAULT.blocchi.map((b) =>
        b.id === "dettaglio-mesi" && b.meseConfig
          ? {
              ...b,
              meseConfig: {
                ...b.meseConfig,
                descrizioneTemplate:
                  "Seduta di logoterapia a favore di {{paziente.cognome}} {{paziente.nome}} per il mese di {{riga.meseLabel}}",
              },
            }
          : b
      ),
    };

    const stream = (await renderToStream(
      <InvoicePDFDocument invoice={invoice} settings={customLayout} />
    )) as AsyncIterable<Buffer>;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
