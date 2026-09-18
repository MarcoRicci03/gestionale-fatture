import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { buildSistemaTsXml } from "@/lib/sistemats/xml-builder";
import type { SpesaSanitariaPayload } from "@/lib/sistemats/types";

// Mock Session & Client IP
vi.mock("@/lib/auth/session", () => ({
  requireUserId: vi.fn(async () => 1),
}));

vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));

// Mock Next.js Cache & Audit
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: vi.fn(async () => {}),
}));

// Mock Vault
vi.mock("@/lib/sistemats/vault", () => ({
  decryptCredential: vi.fn((v: string) => `decrypted_${v}`),
  encryptCredential: vi.fn((v: string) => `encrypted_${v}`),
}));

// We capture the payload passed to buildSistemaTsXml in inviaLottoFatture
let capturedPayload: SpesaSanitariaPayload | null = null;
vi.mock("@/lib/sistemats/xml-builder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sistemats/xml-builder")>();
  return {
    ...actual,
    buildSistemaTsXml: vi.fn((payload: SpesaSanitariaPayload, certPath?: string) => {
      capturedPayload = payload;
      return actual.buildSistemaTsXml(payload, certPath);
    }),
    createZipArchive: vi.fn(async () => Buffer.from("dummy-zip")),
  };
});

// Mock SistemaTsClient
const mockInviaFile = vi.fn().mockResolvedValue({
  success: true,
  protocollo: "PROT-EDGE-CASE-12345",
  dataRicezione: new Date("2026-03-15T10:00:00Z"),
});

vi.mock("@/lib/sistemats/client", () => ({
  SistemaTsClient: class {
    inviaFile = mockInviaFile;
    interrogaEsito = vi.fn();
    scaricaRicevutaPdf = vi.fn();
    scaricaDettaglioErrori = vi.fn();
  },
}));

// Mock Prisma
const mockPagamentoFindMany = vi.fn();
const mockPagamentoUpdateMany = vi.fn();
const mockTrasmissioneCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    impostazioniSistemaTs: {
      findUnique: vi.fn(async () => ({
        id: 1,
        id_Utente: 1,
        username: "TSTUSR01",
        passwordEncrypted: "enc_pwd",
        pincodeEncrypted: "enc_pin",
        codiceRegione: "080",
        codiceAsl: "105",
        codiceStruttura: null,
      })),
    },
    utente: {
      findUnique: vi.fn(async () => ({
        id: 1,
        username: "dott.rossi",
        cf: "RSSMRA85M01H501Q",
        pIva: "01234567890",
      })),
    },
    pagamento: {
      updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
      findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
    },
    trasmissioneTs: {
      create: (...args: unknown[]) => mockTrasmissioneCreate(...args),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        trasmissioneTs: {
          create: (...args: unknown[]) => mockTrasmissioneCreate(...args),
        },
        pagamento: {
          findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
          updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
        },
      };
      return cb(tx);
    }),
  },
}));

import { inviaLottoFatture } from "./sistema-ts";
import { resetSistemaTsRateLimiters } from "@/lib/sistemats/rate-limiters";

describe("Layer 2: Sistema TS Payload Edge Cases & Fiscal Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSistemaTsRateLimiters();
    capturedPayload = null;
    mockPagamentoUpdateMany.mockResolvedValue({ count: 1 });
    mockTrasmissioneCreate.mockResolvedValue({ id: 10, protocollo: "PROT-EDGE-CASE-12345" });
  });

  describe("Regime Fiscale & Natura IVA (N2.2 vs N4)", () => {
    it("costruisce payload con regime forfettario N2.2 quando specificato o per default", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 101,
          n_fattura: 1,
          anno: 2026,
          data: new Date("2026-03-01"),
          prezzo_totale: new Prisma.Decimal("60.00"),
          natura_iva: "N2.2",
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      const result = await inviaLottoFatture([101]);
      expect(result).toHaveProperty("success", true);
      expect(capturedPayload).not.toBeNull();

      const doc = capturedPayload!.documenti[0];
      expect(doc.vociSpesa).toHaveLength(1);
      expect(doc.vociSpesa[0].naturaIva).toBe("N2.2");
      expect(doc.vociSpesa[0].importo).toBe(60);

      // Verifica XML generato
      const xml = buildSistemaTsXml(capturedPayload!);
      expect(xml).toContain("<naturaIVA>N2.2</naturaIVA>");
      expect(xml).not.toContain("<naturaIVA>N4</naturaIVA>");
    });

    it("costruisce payload con natura N4 per prestazione sanitaria esente da regime ordinario", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 102,
          n_fattura: 2,
          anno: 2026,
          data: new Date("2026-03-02"),
          prezzo_totale: new Prisma.Decimal("75.00"),
          natura_iva: "N4", // Ordinario esente art. 10
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      const result = await inviaLottoFatture([102]);
      expect(result).toHaveProperty("success", true);
      expect(capturedPayload).not.toBeNull();

      const doc = capturedPayload!.documenti[0];
      expect(doc.vociSpesa[0].naturaIva).toBe("N4");

      // Verifica XML generato
      const xml = buildSistemaTsXml(capturedPayload!);
      expect(xml).toContain("<naturaIVA>N4</naturaIVA>");
    });

    it("usa fallback 'N2.2' se il campo natura_iva nel database è vuoto o null", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 103,
          n_fattura: 3,
          anno: 2026,
          data: new Date("2026-03-03"),
          prezzo_totale: new Prisma.Decimal("50.00"),
          natura_iva: null, // Nessuna natura specificata
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      const result = await inviaLottoFatture([103]);
      expect(result).toHaveProperty("success", true);

      const doc = capturedPayload!.documenti[0];
      expect(doc.vociSpesa[0].naturaIva).toBe("N2.2");
    });
  });

  describe("Tracciabilità del Pagamento (SI vs NO)", () => {
    it("imposta pagamentoTracciato = 'SI' per pagamenti tracciati (bonifico / carta / pos)", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 201,
          n_fattura: 10,
          anno: 2026,
          data: new Date("2026-03-05"),
          prezzo_totale: new Prisma.Decimal("70.00"),
          natura_iva: "N2.2",
          flag_opposizione: false,
          pagamento_tracciato: true, // Tracciato
          bolloCodice: null,
          pagante: { nome: "Luigi", cognome: "Bianchi", cf: "BNCLGI75C12F205E" },
          paziente: { nome: "Luigi", cognome: "Bianchi", cf: "BNCLGI75C12F205E" },
        },
      ]);

      await inviaLottoFatture([201]);

      const doc = capturedPayload!.documenti[0];
      expect(doc.pagamentoTracciato).toBe("SI");

      const xml = buildSistemaTsXml(capturedPayload!);
      expect(xml).toContain("<pagamentoTracciato>SI</pagamentoTracciato>");
    });

    it("imposta pagamentoTracciato = 'NO' per pagamenti non tracciati (contanti)", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 202,
          n_fattura: 11,
          anno: 2026,
          data: new Date("2026-03-06"),
          prezzo_totale: new Prisma.Decimal("70.00"),
          natura_iva: "N2.2",
          flag_opposizione: false,
          pagamento_tracciato: false, // Contanti
          bolloCodice: null,
          pagante: { nome: "Luigi", cognome: "Bianchi", cf: "BNCLGI75C12F205E" },
          paziente: { nome: "Luigi", cognome: "Bianchi", cf: "BNCLGI75C12F205E" },
        },
      ]);

      await inviaLottoFatture([202]);

      const doc = capturedPayload!.documenti[0];
      expect(doc.pagamentoTracciato).toBe("NO");

      const xml = buildSistemaTsXml(capturedPayload!);
      expect(xml).toContain("<pagamentoTracciato>NO</pagamentoTracciato>");
    });
  });

  describe("Iniezione Automatica Marca da Bollo (2.00 € - Natura dinamica per regime)", () => {
    it("aggiunge riga bollo da 2.00 € con natura N2.2 per forfettari per importo superiore alla soglia di 77.47 €", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 301,
          n_fattura: 20,
          anno: 2026,
          data: new Date("2026-03-10"),
          prezzo_totale: new Prisma.Decimal("120.00"), // > 77.47
          natura_iva: "N2.2",
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      await inviaLottoFatture([301]);

      const doc = capturedPayload!.documenti[0];
      expect(doc.vociSpesa).toHaveLength(2);
      expect(doc.vociSpesa[0]).toEqual({
        tipoSpesa: "SP",
        importo: 120,
        naturaIva: "N2.2",
      });
      expect(doc.vociSpesa[1]).toEqual({
        tipoSpesa: "SP",
        importo: 2,
        naturaIva: "N2.2",
      });

      const xml = buildSistemaTsXml(capturedPayload!);
      expect(xml).toContain("<importo>120.00</importo>");
      expect(xml).toContain("<importo>2.00</importo>");
      expect(xml).toContain("<naturaIVA>N2.2</naturaIVA>");
    });

    it("assegna natura N1 alla marca da bollo per fatture in regime ordinario esente art. 10 (N4)", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 3010,
          n_fattura: 200,
          anno: 2026,
          data: new Date("2026-03-10"),
          prezzo_totale: new Prisma.Decimal("150.00"), // > 77.47
          natura_iva: "N4", // Ordinario esente art. 10
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      await inviaLottoFatture([3010]);

      const doc = capturedPayload!.documenti[0];
      expect(doc.vociSpesa).toHaveLength(2);
      expect(doc.vociSpesa[0]).toEqual({
        tipoSpesa: "SP",
        importo: 150,
        naturaIva: "N4",
      });
      expect(doc.vociSpesa[1]).toEqual({
        tipoSpesa: "SP",
        importo: 2,
        naturaIva: "N1",
      });

      const xml = buildSistemaTsXml(capturedPayload!);
      expect(xml).toContain("<importo>150.00</importo>");
      expect(xml).toContain("<naturaIVA>N4</naturaIVA>");
      expect(xml).toContain("<naturaIVA>N1</naturaIVA>");
    });

    it("aggiunge riga bollo anche per importo <= 77.47 € se provvista di bolloCodice", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 302,
          n_fattura: 21,
          anno: 2026,
          data: new Date("2026-03-11"),
          prezzo_totale: new Prisma.Decimal("50.00"), // <= 77.47
          natura_iva: "N2.2",
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: "01202600001234", // Bollo telematico presente
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      await inviaLottoFatture([302]);

      const doc = capturedPayload!.documenti[0];
      expect(doc.vociSpesa).toHaveLength(2);
      expect(doc.vociSpesa[1].naturaIva).toBe("N2.2");
      expect(doc.vociSpesa[1].importo).toBe(2);
    });

    it("non aggiunge riga bollo se importo <= 77.47 € e bolloCodice è assente", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 303,
          n_fattura: 22,
          anno: 2026,
          data: new Date("2026-03-12"),
          prezzo_totale: new Prisma.Decimal("77.47"), // Limite esatto senza bolloCodice
          natura_iva: "N2.2",
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      await inviaLottoFatture([303]);

      const doc = capturedPayload!.documenti[0];
      expect(doc.vociSpesa).toHaveLength(1);
      expect(doc.vociSpesa[0].importo).toBe(77.47);
    });
  });

  describe("Opposizione Assistito (Privacy & Tutela Dati)", () => {
    it("con opposizione attiva azzera cfCittadino, imposta flagOpposizione = 1 e omette il tag cfCittadino dall'XML", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 401,
          n_fattura: 30,
          anno: 2026,
          data: new Date("2026-03-13"),
          prezzo_totale: new Prisma.Decimal("80.00"),
          natura_iva: "N2.2",
          flag_opposizione: true, // Opposizione attiva
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Gianna", cognome: "Nannini", cf: null }, // Senza CF
          paziente: { nome: "Gianna", cognome: "Nannini", cf: null },
        },
      ]);

      const result = await inviaLottoFatture([401]);
      expect(result).toHaveProperty("success", true);

      const doc = capturedPayload!.documenti[0];
      expect(doc.cfCittadino).toBe("");
      expect(doc.flagOpposizione).toBe(1);

      // Verifica stringa XML: <cfCittadino> NON deve esistere, <flagOpposizione>1</flagOpposizione> DEVE esistere
      const xml = buildSistemaTsXml(capturedPayload!);
      expect(xml).not.toContain("<cfCittadino>");
      expect(xml).toContain("<flagOpposizione>1</flagOpposizione>");
    });

    it("senza opposizione e con CF valido include il CF nel payload e nell'XML", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 402,
          n_fattura: 31,
          anno: 2026,
          data: new Date("2026-03-14"),
          prezzo_totale: new Prisma.Decimal("80.00"),
          natura_iva: "N2.2",
          flag_opposizione: false, // Nessuna opposizione
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      const result = await inviaLottoFatture([402]);
      expect(result).toHaveProperty("success", true);

      const doc = capturedPayload!.documenti[0];
      expect(doc.cfCittadino).toBe("RSSMRA85M01H501Q");
      expect(doc.flagOpposizione).toBe(0);

      const xml = buildSistemaTsXml(capturedPayload!);
      expect(xml).toContain("<cfCittadino>");
      expect(xml).not.toContain("<flagOpposizione>1</flagOpposizione>");
    });
  });

  describe("Validazione Preventiva Importo (XSD Dec7MinTipo: min 0.01 €, max 99.999,99 €)", () => {
    it("rifiuta preventivamente fatture con importo pari a 0.00 € ed esegue il rollback del lock", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 501,
          n_fattura: 50,
          anno: 2026,
          data: new Date("2026-03-15"),
          prezzo_totale: new Prisma.Decimal("0.00"), // Importo non valido per XSD Sogei
          natura_iva: "N2.2",
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      const result = await inviaLottoFatture([501]);
      expect(result).toHaveProperty("error");
      if ("error" in result) {
        expect(result.error).toContain("Fattura n. 50/2026");
        expect(result.error).toContain("maggiore di zero");
      }

      // Verifica che non sia stata effettuata alcuna chiamata HTTP a Sogei
      expect(mockInviaFile).not.toHaveBeenCalled();

      // Verifica rollback atomico del lock su DA_INVIARE
      expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [501] } }),
          data: { stato_ts: "DA_INVIARE", data_invio_ts: null },
        })
      );
    });

    it("rifiuta fatture con importo superiore a 99.999,99 € ed esegue il rollback del lock", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 502,
          n_fattura: 51,
          anno: 2026,
          data: new Date("2026-03-15"),
          prezzo_totale: new Prisma.Decimal("100000.00"), // Supera Dec7MinTipo
          natura_iva: "N2.2",
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      const result = await inviaLottoFatture([502]);
      expect(result).toHaveProperty("error");
      if ("error" in result) {
        expect(result.error).toContain("Fattura n. 51/2026");
        expect(result.error).toContain("supera il limite massimo");
      }

      expect(mockInviaFile).not.toHaveBeenCalled();
      expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [502] } }),
          data: { stato_ts: "DA_INVIARE", data_invio_ts: null },
        })
      );
    });

    it("accetta e trasmette fatture con importo valido minimo (0.01 €)", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([
        {
          id: 503,
          n_fattura: 52,
          anno: 2026,
          data: new Date("2026-03-15"),
          prezzo_totale: new Prisma.Decimal("0.01"),
          natura_iva: "N2.2",
          flag_opposizione: false,
          pagamento_tracciato: true,
          bolloCodice: null,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
          paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
      ]);

      const result = await inviaLottoFatture([503]);
      expect(result).toHaveProperty("success", true);
      expect(mockInviaFile).toHaveBeenCalled();
    });
  });
});
