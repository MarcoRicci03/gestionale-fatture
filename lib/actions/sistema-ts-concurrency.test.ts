import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInviaFile = vi.fn();

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
    },
  };
});

const mockPagamentoFindMany = vi.fn();
const mockPagamentoFindFirst = vi.fn();
const mockPagamentoUpdate = vi.fn();
const mockPagamentoUpdateMany = vi.fn();
const mockTrasmissioneCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pagamento: {
      findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
      findFirst: (...args: unknown[]) => mockPagamentoFindFirst(...args),
      update: (...args: unknown[]) => mockPagamentoUpdate(...args),
      updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
    },
    trasmissioneTs: {
      create: (...args: unknown[]) => mockTrasmissioneCreate(...args),
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
          updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
        },
      };
      return cb(tx);
    }),
  },
}));

import {
  inviaLottoFatture,
  annullaFatturaTs,
  ripristinaFatturaPerReinvio,
} from "./sistema-ts";
import { Prisma } from "@prisma/client";

function createMockInvoice(id: number, nFattura: number, statoTs = "DA_INVIARE") {
  return {
    id,
    n_fattura: nFattura,
    anno: 2026,
    data: new Date("2026-03-01"),
    prezzo_totale: new Prisma.Decimal(100),
    natura_iva: "N2.2",
    flag_opposizione: false,
    pagamento_tracciato: true,
    bolloCodice: null,
    stato_ts: statoTs,
    protocollo_ts: null,
    pagante: {
      nome: "Mario",
      cognome: "Rossi",
      cf: "RSSMRA85M01H501Q",
    },
    paziente: {
      nome: "Mario",
      cognome: "Rossi",
      cf: "RSSMRA85M01H501Q",
    },
  };
}

describe("Sistema TS Concurrency Lock & State Transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPagamentoUpdateMany.mockResolvedValue({ count: 2 });
    mockInviaFile.mockResolvedValue({
      success: true,
      protocollo: "PROT-2026-999",
      codiceEsito: "0",
      descrizioneEsito: "Acquisito",
    });
    mockTrasmissioneCreate.mockResolvedValue({ id: 55 });
  });

  it("Happy Path: acquisisce lock IN_TRASMISSIONE, trasmette a Sogei e promuove a INVIATA", async () => {
    const mockInvoices = [
      createMockInvoice(101, 1),
      createMockInvoice(102, 2),
    ];
    mockPagamentoFindMany.mockResolvedValueOnce(mockInvoices);

    const result = await inviaLottoFatture([101, 102]);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        protocollo: "PROT-2026-999",
      })
    );

    // 1. Stale lock recovery call:
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          stato_ts: "IN_TRASMISSIONE",
        }),
        data: expect.objectContaining({
          stato_ts: "DA_INVIARE",
        }),
      })
    );

    // 2. Lock atomico transitorio:
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101, 102] },
          stato_ts: "DA_INVIARE",
        }),
        data: expect.objectContaining({
          stato_ts: "IN_TRASMISSIONE",
        }),
      })
    );

    // 3. Chiamata di rete eseguita
    expect(mockInviaFile).toHaveBeenCalledTimes(1);

    // 4. Promozione finale a INVIATA dentro $transaction
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101, 102] },
          stato_ts: "IN_TRASMISSIONE",
        }),
        data: expect.objectContaining({
          stato_ts: "INVIATA",
          protocollo_ts: "PROT-2026-999",
        }),
      })
    );
  });

  it("Collisione di concorrenza: se un'altra chiamata ha già acquisito il lock, abortisce senza chiamare Sogei", async () => {
    const mockInvoices = [
      createMockInvoice(101, 1),
      createMockInvoice(102, 2),
    ];
    mockPagamentoFindMany.mockResolvedValueOnce(mockInvoices);

    // Simulazione di collisione: l'update atomico aggiorna 0 righe perché un'altra richiesta le ha già passate a IN_TRASMISSIONE
    mockPagamentoUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // 1st call: stale recovery
      .mockResolvedValueOnce({ count: 0 }); // 2nd call: lock attempt collision!

    const result = await inviaLottoFatture([101, 102]);

    expect(result).toEqual({
      error:
        "Una o più fatture selezionate sono già in fase di trasmissione o non sono più nello stato 'Da Inviare'. Riprova tra poco.",
    });

    // CRITICO: Sogei NON deve essere chiamato!
    expect(mockInviaFile).not.toHaveBeenCalled();
    expect(mockTrasmissioneCreate).not.toHaveBeenCalled();
  });

  it("Collisione parziale: se solo alcune righe vengono bloccate, effettua rollback di quelle bloccate", async () => {
    const mockInvoices = [
      createMockInvoice(101, 1),
      createMockInvoice(102, 2),
    ];
    mockPagamentoFindMany.mockResolvedValueOnce(mockInvoices);

    // Simulazione: solo 1 su 2 bloccata
    mockPagamentoUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // 1st call: stale recovery
      .mockResolvedValueOnce({ count: 1 }); // 2nd call: lock count = 1 != 2!

    const result = await inviaLottoFatture([101, 102]);

    expect(result).toHaveProperty("error");
    expect(mockInviaFile).not.toHaveBeenCalled();

    // 3rd call must be rollback of the partial lock
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101, 102] },
          stato_ts: "IN_TRASMISSIONE",
        }),
        data: expect.objectContaining({
          stato_ts: "DA_INVIARE",
          data_invio_ts: null,
        }),
      })
    );
  });

  it("Rollback su rifiuto Sogei: se Sogei restituisce esito negativo, ripristina DA_INVIARE", async () => {
    const mockInvoices = [createMockInvoice(101, 1)];
    mockPagamentoFindMany.mockResolvedValueOnce(mockInvoices);

    mockPagamentoUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // stale recovery
      .mockResolvedValueOnce({ count: 1 }); // lock ok

    mockInviaFile.mockResolvedValueOnce({
      success: false,
      errorMessage: "Errore S017: File già presente",
    });

    const result = await inviaLottoFatture([101]);

    expect(result).toEqual({
      error: "Errore S017: File già presente",
    });

    // Deve aver fatto rollback da IN_TRASMISSIONE a DA_INVIARE
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101] },
          stato_ts: "IN_TRASMISSIONE",
        }),
        data: expect.objectContaining({
          stato_ts: "DA_INVIARE",
          data_invio_ts: null,
        }),
      })
    );
    expect(mockTrasmissioneCreate).not.toHaveBeenCalled();
  });

  it("Rollback su eccezione di rete: se la chiamata lancia errore (es. timeout), ripristina DA_INVIARE", async () => {
    const mockInvoices = [createMockInvoice(101, 1)];
    mockPagamentoFindMany.mockResolvedValueOnce(mockInvoices);

    mockPagamentoUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // stale recovery
      .mockResolvedValueOnce({ count: 1 }); // lock ok

    mockInviaFile.mockRejectedValueOnce(new Error("Connection reset by peer"));

    const result = await inviaLottoFatture([101]);

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Connection reset by peer");
    }

    // Deve aver fatto rollback da IN_TRASMISSIONE a DA_INVIARE nel blocco catch
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101] },
          stato_ts: "IN_TRASMISSIONE",
        }),
        data: expect.objectContaining({
          stato_ts: "DA_INVIARE",
          data_invio_ts: null,
        }),
      })
    );
  });

  it("annullaFatturaTs: rifiuta l'annullamento se la fattura è in IN_TRASMISSIONE", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 200,
      n_fattura: 10,
      anno: 2026,
      stato_ts: "IN_TRASMISSIONE",
    });

    const result = await annullaFatturaTs(200);

    expect(result).toEqual({
      error:
        "La fattura è attualmente in fase di trasmissione. Attendi il completamento prima di annullarla.",
    });
    expect(mockInviaFile).not.toHaveBeenCalled();
  });

  it("ripristinaFatturaPerReinvio: consente lo sblocco manuale se la fattura è rimasta in IN_TRASMISSIONE", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 200,
      n_fattura: 10,
      anno: 2026,
      stato_ts: "IN_TRASMISSIONE",
    });
    mockPagamentoUpdate.mockResolvedValueOnce({ id: 200 });

    const result = await ripristinaFatturaPerReinvio(200);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
      })
    );
    expect(mockPagamentoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 200 },
        data: expect.objectContaining({
          stato_ts: "DA_INVIARE",
        }),
      })
    );
  });
});
