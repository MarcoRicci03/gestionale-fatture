import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSistemaTsXml, createZipArchive } from "./xml-builder";
import type { SpesaSanitariaPayload } from "./types";

const MOCK_CERT = path.join(process.cwd(), "certs", "mock_sanitelcf.cer");

describe("xml-builder — generazione XML e ZIP v2.5", () => {
  const samplePayload: SpesaSanitariaPayload = {
    proprietario: {
      codiceRegione: "000",
      codiceAsl: "000",
      cfProprietario: "RSSMRA80A01H501Z",
    },
    documenti: [
      {
        idSpesa: {
          pIva: "01234567890",
          dataEmissione: new Date(2026, 2, 10), // 10 Marzo 2026
          numDocumento: "1",
          dispositivo: 1,
        },
        dataPagamento: new Date(2026, 2, 10),
        flagOperazione: "I",
        cfCittadino: "RSSMRA85M01H501Q",
        pagamentoTracciato: "SI",
        tipoDocumento: "F",
        flagOpposizione: 0,
        vociSpesa: [
          {
            tipoSpesa: "SP",
            importo: 120.0,
            naturaIva: "N2.2",
          },
          {
            tipoSpesa: "SP",
            importo: 2.0,
            naturaIva: "N1",
          },
        ],
      },
    ],
  };

  it("genera un XML ben formato conforme a 730_precompilata.xsd", () => {
    const xml = buildSistemaTsXml(samplePayload, MOCK_CERT);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<precompilata xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    expect(xml).toContain("<codiceRegione>000</codiceRegione>");
    expect(xml).toContain("<codiceAsl>000</codiceAsl>");
    expect(xml).toContain("<pIva>01234567890</pIva>");
    expect(xml).toContain("<dataEmissione>2026-03-10</dataEmissione>");
    expect(xml).toContain("<numDocumento>1</numDocumento>");
    expect(xml).toContain("<flagOperazione>I</flagOperazione>");
    expect(xml).toContain("<pagamentoTracciato>SI</pagamentoTracciato>");
    expect(xml).toContain("<tipoSpesa>SP</tipoSpesa>");
    expect(xml).toContain("<importo>120.00</importo>");
    expect(xml).toContain("<naturaIVA>N2.2</naturaIVA>");
    // Riga bollo
    expect(xml).toContain("<importo>2.00</importo>");
    expect(xml).toContain("<naturaIVA>N1</naturaIVA>");
  });

  it("crea un archivio ZIP valido con compressione DEFLATE", async () => {
    const xml = buildSistemaTsXml(samplePayload, MOCK_CERT);
    const zipBuffer = await createZipArchive(xml, "730.xml");

    expect(zipBuffer).toBeInstanceOf(Buffer);
    expect(zipBuffer.length).toBeGreaterThan(0);
    // Firma ZIP (PK\x03\x04)
    expect(zipBuffer[0]).toBe(0x50);
    expect(zipBuffer[1]).toBe(0x4b);
  });

  it("omette il tag cfCittadino quando flagOpposizione è 1 per evitare scarto S050", () => {
    const opposedPayload: SpesaSanitariaPayload = {
      ...samplePayload,
      documenti: [
        {
          ...samplePayload.documenti[0],
          flagOpposizione: 1,
        },
      ],
    };

    const xml = buildSistemaTsXml(opposedPayload, MOCK_CERT);
    expect(xml).toContain("<flagOpposizione>1</flagOpposizione>");
    expect(xml).not.toContain("<cfCittadino>");
  });
});
