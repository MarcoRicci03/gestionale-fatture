import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInviaFile = vi.fn();
const mockInterrogaEsito = vi.fn();
const mockScaricaRicevutaPdf = vi.fn();
const mockScaricaDettaglioErrori = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireUserId: vi.fn(async () => 1),
}));

vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: vi.fn(async () => {}),
}));

vi.mock("@/lib/sistemats/vault", () => ({
  decryptCredential: vi.fn((v: string) => v),
  encryptCredential: vi.fn((v: string) => v),
}));

vi.mock("@/lib/sistemats/xml-builder", () => ({
  buildSistemaTsXml: vi.fn(() => "<xml/>"),
  createZipArchive: vi.fn(async () => Buffer.from("fake-zip")),
}));

vi.mock("@/lib/sistemats/client", () => {
  return {
    SistemaTsClient: class {
      inviaFile = mockInviaFile;
      interrogaEsito = mockInterrogaEsito;
      scaricaRicevutaPdf = mockScaricaRicevutaPdf;
      scaricaDettaglioErrori = mockScaricaDettaglioErrori;
    },
  };
});

const mockPagamentoFindFirst = vi.fn();
const mockPagamentoUpdate = vi.fn();
const mockPagamentoUpdateMany = vi.fn();
const mockTrasmissioneCreate = vi.fn();
const mockTrasmissioneFindFirst = vi.fn();
const mockTrasmissioneUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pagamento: {
      findFirst: (...args: unknown[]) => mockPagamentoFindFirst(...args),
      update: (...args: unknown[]) => mockPagamentoUpdate(...args),
      updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
    },
    trasmissioneTs: {
      create: (...args: unknown[]) => mockTrasmissioneCreate(...args),
      findFirst: (...args: unknown[]) => mockTrasmissioneFindFirst(...args),
      update: (...args: unknown[]) => mockTrasmissioneUpdate(...args),
    },
    impostazioniSistemaTs: {
      findUnique: vi.fn(async () => ({
        id_Utente: 1,
        username: "user",
        passwordEncrypted: "pwd",
        pincodeEncrypted: "pin",
        codiceRegione: "000",
        codiceAsl: "000",
      })),
    },
    utente: {
      findUnique: vi.fn(async () => ({
        id: 1,
        cf: "RSSMRA85M01H501Q",
        pIva: "12345678901",
      })),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        trasmissioneTs: {
          create: (...args: unknown[]) => mockTrasmissioneCreate(...args),
        },
        pagamento: {
          update: (...args: unknown[]) => mockPagamentoUpdate(...args),
        },
      };
      return cb(tx);
    }),
  },
}));

import { annullaFatturaTs, sincronizzaEsitoTrasmissione } from "./sistema-ts";
import { Prisma } from "@prisma/client";

describe("annullaFatturaTs — Creazione TrasmissioneTs e stato pending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea un record TrasmissioneTs con stato '0' e imposta la fattura su DA_CANCELLARE_SU_TS", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 42,
      id_Utente: 1,
      n_fattura: 7,
      anno: 2026,
      data: new Date("2026-02-01"),
      prezzo_totale: new Prisma.Decimal(100),
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: false,
      pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
      paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
    });

    mockInviaFile.mockResolvedValueOnce({
      success: true,
      protocollo: "PROT_ANN_12345",
      codiceEsito: "000",
      descrizioneEsito: "File inviato con successo",
    });

    const result = await annullaFatturaTs(42);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        protocollo: "PROT_ANN_12345",
      })
    );

    // Verifica creazione TrasmissioneTs con statoElaborazione: "0"
    expect(mockTrasmissioneCreate).toHaveBeenCalledTimes(1);
    expect(mockTrasmissioneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id_Utente: 1,
          protocollo: "PROT_ANN_12345",
          nomeFile: "annulla_7.zip",
          statoElaborazione: "0",
          numRicevuti: 1,
        }),
      })
    );

    // Verifica stato fattura: DA_CANCELLARE_SU_TS (NON ANNULLATA_TS immediato)
    expect(mockPagamentoUpdate).toHaveBeenCalledTimes(1);
    expect(mockPagamentoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: expect.objectContaining({
          stato_ts: "DA_CANCELLARE_SU_TS",
          protocollo_cancellazione_ts: "PROT_ANN_12345",
        }),
      })
    );
  });
});

describe("sincronizzaEsitoTrasmissione — Riconciliazione esito cancellazione", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("se l'annullamento è ACCOLTO ('2'), porta la fattura in ANNULLATA_TS e scarica la ricevuta", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 99,
      id_Utente: 1,
      protocollo: "PROT_ANN_12345",
      nomeFile: "annulla_7.zip",
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: true,
      statoElaborazione: "2", // Accolto
      codiceEsito: "000",
      descrizioneEsito: "Documento annullato",
      numDocumentiRicevuti: 1,
      numDocumentiAccolti: 1,
      numDocumentiScartati: 0,
    });

    mockScaricaRicevutaPdf.mockResolvedValueOnce({
      success: true,
      pdfBuffer: Buffer.from("pdf-ricevuta-cancellazione"),
    });

    const result = await sincronizzaEsitoTrasmissione(99);

    expect(result).toEqual(expect.objectContaining({ success: true }));

    // Aggiornamento trasmissione con esito e ricevuta
    expect(mockTrasmissioneUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 99 },
        data: expect.objectContaining({
          statoElaborazione: "2",
          pdfRicevuta: expect.any(Uint8Array),
        }),
      })
    );

    // Fattura portata ad ANNULLATA_TS
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          protocollo_cancellazione_ts: "PROT_ANN_12345",
        }),
        data: {
          stato_ts: "ANNULLATA_TS",
        },
      })
    );
  });

  it("se l'annullamento è SCARTATO ('4'), la fattura torna a INVIATA (attiva su TS)", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 100,
      id_Utente: 1,
      protocollo: "PROT_ANN_SCARTATO",
      nomeFile: "annulla_7.zip",
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: true,
      statoElaborazione: "4", // Scartato
      codiceEsito: "S016",
      descrizioneEsito: "Documento non trovato",
      numDocumentiRicevuti: 1,
      numDocumentiAccolti: 0,
      numDocumentiScartati: 1,
    });

    mockScaricaDettaglioErrori.mockResolvedValueOnce({
      success: true,
      rawCsv: "7;S016;Documento non trovato;ERRORE",
    });

    const result = await sincronizzaEsitoTrasmissione(100);

    expect(result).toEqual(expect.objectContaining({ success: true }));

    // Aggiornamento trasmissione con esito e report errori
    expect(mockTrasmissioneUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: expect.objectContaining({
          statoElaborazione: "4",
          csvErrori: expect.stringContaining("S016"),
        }),
      })
    );

    // Fattura ripristinata a INVIATA (non ANNULLATA_TS, perché su TS è ancora valida)
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          protocollo_cancellazione_ts: "PROT_ANN_SCARTATO",
        }),
        data: {
          stato_ts: "INVIATA",
        },
      })
    );
  });
});

describe("sincronizzaEsitoTrasmissione — Scarto intera trasmissione senza CSV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("se la trasmissione è SCARTATA ('4') senza CSV, resetta tutte le fatture del lotto a DA_INVIARE", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 200,
      id_Utente: 1,
      protocollo: "PROT_SCARTO_4",
      nomeFile: "lotto_dati_spesa_1.zip",
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: true,
      statoElaborazione: "4", // Scartato a livello trasmissione
      codiceEsito: "E001",
      descrizioneEsito: "Busta XML non valida",
      numDocumentiRicevuti: 0,
      numDocumentiAccolti: 0,
      numDocumentiScartati: 0,
    });

    mockScaricaDettaglioErrori.mockResolvedValueOnce({
      success: false,
      errorMessage: "Nessun CSV disponibile per scarto di livello file",
    });

    const result = await sincronizzaEsitoTrasmissione(200);

    expect(result).toEqual(expect.objectContaining({ success: true }));

    // Verifica reset di tutte le fatture collegate a DA_INVIARE
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id_Utente: 1,
          id_TrasmissioneTs: 200,
        }),
        data: {
          stato_ts: "DA_INVIARE",
        },
      })
    );
  });

  it("se la trasmissione è SCARTATA ('5') senza CSV, resetta tutte le fatture del lotto a DA_INVIARE", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 201,
      id_Utente: 1,
      protocollo: "PROT_SCARTO_5",
      nomeFile: "lotto_dati_spesa_2.zip",
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: true,
      statoElaborazione: "5", // Scartato irreversibile
      codiceEsito: "E002",
      descrizioneEsito: "Firma digitale non valida o credenziali errate",
      numDocumentiRicevuti: 0,
      numDocumentiAccolti: 0,
      numDocumentiScartati: 0,
    });

    mockScaricaDettaglioErrori.mockResolvedValueOnce({
      success: false,
    });

    const result = await sincronizzaEsitoTrasmissione(201);

    expect(result).toEqual(expect.objectContaining({ success: true }));

    // Verifica reset di tutte le fatture collegate a DA_INVIARE
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id_Utente: 1,
          id_TrasmissioneTs: 201,
        }),
        data: {
          stato_ts: "DA_INVIARE",
        },
      })
    );
  });
});
