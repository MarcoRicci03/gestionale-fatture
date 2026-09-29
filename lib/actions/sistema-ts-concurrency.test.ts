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
  needsReencryption: vi.fn(() => false),
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
          findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
          updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
          update: (...args: unknown[]) => mockPagamentoUpdate(...args),
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
import { resetSistemaTsRateLimiters } from "@/lib/sistemats/rate-limiters";
import { logAudit } from "@/lib/audit/log";
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
    bolloCodice: "01202600001234",
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
    resetSistemaTsRateLimiters();
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

    // 3. CR-10: segno di invio avviato scritto prima della chiamata di rete
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101, 102] },
          stato_ts: "IN_TRASMISSIONE",
        }),
        data: { invio_avviato_ts: expect.any(Date) },
      })
    );
    expect(mockPagamentoUpdateMany.mock.invocationCallOrder[2]).toBeLessThan(
      mockInviaFile.mock.invocationCallOrder[0]
    );

    // 4. Chiamata di rete eseguita
    expect(mockInviaFile).toHaveBeenCalledTimes(1);

    // 5. Promozione finale a INVIATA dentro $transaction
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101, 102] },
          stato_ts: "IN_TRASMISSIONE",
        }),
        data: expect.objectContaining({
          stato_ts: "INVIATA",
          protocollo_ts: "PROT-2026-999",
          invio_avviato_ts: null,
        }),
      })
    );
  });

  it("Collisione di concorrenza: se un'altra chiamata ha già acquisito il lock, abortisce senza chiamare Sogei", async () => {
    // Simulazione di collisione: l'update atomico aggiorna 0 righe perché un'altra richiesta le ha già passate a IN_TRASMISSIONE
    mockPagamentoUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // 1st call: stale recovery
      .mockResolvedValueOnce({ count: 0 }); // 2nd call: lock attempt collision!

    const result = await inviaLottoFatture([101, 102]);

    expect(result).toEqual({
      success: false,
      error:
        "Una o più fatture selezionate sono già in fase di trasmissione o non sono più nello stato 'Da Inviare'. Riprova tra poco.",
    });

    // CRITICO: Sogei NON deve essere chiamato!
    expect(mockInviaFile).not.toHaveBeenCalled();
    expect(mockTrasmissioneCreate).not.toHaveBeenCalled();
  });

  it("Collisione parziale: se solo alcune righe vengono bloccate, abortisce la transazione atomica senza chiamare Sogei", async () => {
    // Simulazione: solo 1 su 2 bloccata
    mockPagamentoUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // 1st call: stale recovery
      .mockResolvedValueOnce({ count: 1 }); // 2nd call: lock count = 1 != 2!

    const result = await inviaLottoFatture([101, 102]);

    expect(result).toEqual({
      success: false,
      error:
        "Una o più fatture selezionate sono già in fase di trasmissione o non sono più nello stato 'Da Inviare'. Riprova tra poco.",
    });
    expect(mockInviaFile).not.toHaveBeenCalled();
    expect(mockTrasmissioneCreate).not.toHaveBeenCalled();
  });

  it("Prevenzione selezione parziale (phantom selection): se una fattura non è più DA_INVIARE, abortisce", async () => {
    mockPagamentoUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // stale recovery
      .mockResolvedValueOnce({ count: 1 }); // solo 1 su 2 aggiornata

    const result = await inviaLottoFatture([101, 102]);

    expect(result).toEqual({
      success: false,
      error:
        "Una o più fatture selezionate sono già in fase di trasmissione o non sono più nello stato 'Da Inviare'. Riprova tra poco.",
    });
    expect(mockInviaFile).not.toHaveBeenCalled();
    expect(mockTrasmissioneCreate).not.toHaveBeenCalled();
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
      success: false,
      error: "Errore S017: File già presente",
    });

    // Rifiuto certo: rollback da IN_TRASMISSIONE a DA_INVIARE (la 3a chiamata
    // è il segno di invio avviato, CR-10)
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      4,
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

  it("Rollback su eccezione prima della rete: se inviaFile lancia (es. cifratura del pincode), ripristina DA_INVIARE", async () => {
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

    // inviaFile lancia solo prima del fetch (gli errori di rete tornano come
    // esitoIncerto): nulla è partito, rollback nel blocco catch
    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      4,
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

  describe("CR-02: protocollo acquisito ma registrazione nel DB fallita", () => {
    const rollbackCall = expect.objectContaining({
      where: expect.objectContaining({ id: { in: [101] } }),
      data: expect.objectContaining({ stato_ts: "DA_INVIARE" }),
    });

    beforeEach(() => {
      mockPagamentoFindMany.mockResolvedValueOnce([createMockInvoice(101, 1)]);
      mockPagamentoUpdateMany
        .mockResolvedValueOnce({ count: 0 }) // stale recovery
        .mockResolvedValueOnce({ count: 1 }); // lock ok
    });

    it("errore DB transitorio: il secondo tentativo registra la trasmissione, nessun rollback", async () => {
      mockTrasmissioneCreate.mockRejectedValueOnce(new Error("Connection terminated unexpectedly"));

      const result = await inviaLottoFatture([101]);

      expect(result).toEqual(
        expect.objectContaining({ success: true, protocollo: "PROT-2026-999" })
      );
      expect(mockInviaFile).toHaveBeenCalledTimes(1);
      expect(mockTrasmissioneCreate).toHaveBeenCalledTimes(2);
      expect(mockPagamentoUpdateMany).not.toHaveBeenCalledWith(rollbackCall);
    });

    it("violazione di unicità su protocollo al secondo tentativo: la trasmissione risulta già registrata", async () => {
      mockTrasmissioneCreate
        .mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
            meta: { target: ["protocollo"] },
          })
        );

      const result = await inviaLottoFatture([101]);

      expect(result).toEqual(
        expect.objectContaining({ success: true, protocollo: "PROT-2026-999" })
      );
      expect(mockPagamentoUpdateMany).not.toHaveBeenCalledWith(rollbackCall);
    });

    it("errore DB persistente: nessun rollback, protocollo salvato di ripiego e messaggio 'NON reinviare'", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockTrasmissioneCreate.mockRejectedValue(new Error("Connection terminated unexpectedly"));

      const result = await inviaLottoFatture([101]);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("protocollo PROT-2026-999"),
      });
      expect(result).toHaveProperty("error", expect.stringContaining("NON reinviare"));
      expect(mockPagamentoUpdateMany).not.toHaveBeenCalledWith(rollbackCall);
      expect(mockPagamentoUpdateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: { in: [101] }, stato_ts: "IN_TRASMISSIONE" }),
        data: { protocollo_ts: "PROT-2026-999" },
      });
      expect(consoleError).toHaveBeenCalledWith(
        "TS_PROTOCOLLO_NON_REGISTRATO",
        expect.objectContaining({ protocollo: "PROT-2026-999", invoiceIds: [101] }),
        expect.any(Error)
      );

      consoleError.mockRestore();
      mockTrasmissioneCreate.mockReset();
    });
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
      success: false,
      error:
        "La fattura è attualmente in fase di trasmissione. Attendi il completamento prima di annullarla.",
    });
    expect(mockInviaFile).not.toHaveBeenCalled();
  });

  it("annullaFatturaTs: in caso di doppia invocazione simultanea, solo una acquisisce il lock e invia a Sogei", async () => {
    const invoice = createMockInvoice(201, 15, "INVIATA");
    mockPagamentoFindFirst.mockResolvedValue(invoice);

    let locked = false;
    mockPagamentoUpdateMany.mockImplementation(async (args?: { where?: { annullamento_avviato_ts?: unknown } }) => {
      // Rilascio del proprio lock (CR-07): where condizionata sul lockTimestamp
      if (args?.where?.annullamento_avviato_ts instanceof Date) {
        return { count: 1 };
      }
      // Tentativo di lock atomico: solo la prima chiamata concorrente ottiene il lock (CAS)
      if (!locked) {
        locked = true;
        return { count: 1 };
      }
      // Collisione: la seconda chiamata trova la risorsa già bloccata
      return { count: 0 };
    });

    const [res1, res2] = await Promise.all([
      annullaFatturaTs(201),
      annullaFatturaTs(201),
    ]);

    expect(res1).toEqual(
      expect.objectContaining({
        success: true,
        protocollo: "PROT-2026-999",
      })
    );

    expect(res2).toEqual({
      success: false,
      error:
        "È già in corso un annullamento per questa fattura. Attendi il completamento e ricarica la pagina.",
    });

    // CRITICO: Sogei inviaFile deve essere stato chiamato ESATTAMENTE UNA SOLA VOLTA!
    expect(mockInviaFile).toHaveBeenCalledTimes(1);
  });

  it("stale lock recovery in inviaLottoFatture non tocca fatture con protocollo_ts (cancellazioni)", async () => {
    mockPagamentoUpdateMany.mockResolvedValue({ count: 0 });
    mockPagamentoFindMany.mockResolvedValueOnce([]);

    await inviaLottoFatture([101]);

    expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          stato_ts: "IN_TRASMISSIONE",
          protocollo_ts: null,
        }),
      })
    );
  });

  it("ripristinaFatturaPerReinvio: consente lo sblocco manuale di un invio iniziale con lock scaduto", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 200,
      n_fattura: 10,
      anno: 2026,
      stato_ts: "IN_TRASMISSIONE",
      protocollo_ts: null,
      data_invio_ts: new Date(Date.now() - 10 * 60 * 1000), // 10 minuti fa
    });
    mockPagamentoUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await ripristinaFatturaPerReinvio(200);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
      })
    );
    // CR-03: la scrittura ricontrolla le stesse condizioni (niente race).
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 200,
        id_Utente: 1,
        stato_ts: "IN_TRASMISSIONE",
        protocollo_ts: null,
        invio_avviato_ts: null,
        data_invio_ts: { lt: expect.any(Date) },
      },
      data: { stato_ts: "DA_INVIARE", protocollo_ts: null, data_invio_ts: null },
    });
  });

  it("CR-03: rifiuta lo sblocco se il lock è recente (chiamata a Sogei forse ancora in volo)", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 201,
      n_fattura: 11,
      anno: 2026,
      stato_ts: "IN_TRASMISSIONE",
      protocollo_ts: null,
      data_invio_ts: new Date(Date.now() - 30 * 1000), // 30 secondi fa
    });

    const result = await ripristinaFatturaPerReinvio(201);

    expect(result).toEqual({
      success: false,
      error: "Trasmissione in corso: riprova tra qualche minuto.",
    });
    expect(mockPagamentoUpdateMany).not.toHaveBeenCalled();
    expect(mockPagamentoUpdate).not.toHaveBeenCalled();
  });

  it("CR-03: rifiuta lo sblocco se la fattura ha già un protocollo (già sul Sistema TS)", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 202,
      n_fattura: 12,
      anno: 2026,
      stato_ts: "IN_TRASMISSIONE",
      protocollo_ts: "PROT-GIA-ACQUISITO",
      data_invio_ts: new Date(Date.now() - 60 * 60 * 1000), // anche se il lock è vecchio
    });

    const result = await ripristinaFatturaPerReinvio(202);

    expect(result).toEqual({
      success: false,
      // CR-07: con protocollo è solo il caso CR-02 (lotto acquisito ma non registrato)
      error: expect.stringMatching(/protocollo PROT-GIA-ACQUISITO.*non è stato registrato/),
    });
    expect(mockPagamentoUpdateMany).not.toHaveBeenCalled();
    expect(mockPagamentoUpdate).not.toHaveBeenCalled();
  });

  describe("CR-10: invio con esito incerto", () => {
    const MINUTO = 60 * 1000;

    // vi.clearAllMocks non svuota le code dei mockResolvedValueOnce lasciate
    // dai test precedenti.
    beforeEach(() => {
      mockPagamentoFindMany.mockReset();
      mockPagamentoFindFirst.mockReset();
      mockPagamentoUpdateMany.mockReset();
      mockPagamentoUpdateMany.mockResolvedValue({ count: 1 });
    });

    it("con esitoIncerto non esegue il rollback e lascia le fatture bloccate", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([createMockInvoice(101, 1)]);
      mockPagamentoUpdateMany
        .mockResolvedValueOnce({ count: 0 }) // stale recovery
        .mockResolvedValueOnce({ count: 1 }) // lock
        .mockResolvedValueOnce({ count: 1 }); // invio avviato
      mockInviaFile.mockResolvedValueOnce({
        success: false,
        statusCode: 0,
        errorMessage: "Errore di rete: timeout",
        esitoIncerto: true,
      });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await inviaLottoFatture([101]);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Esito da verificare"),
      });
      expect(mockPagamentoUpdateMany).toHaveBeenCalledTimes(3);
      const rollback = mockPagamentoUpdateMany.mock.calls.find(
        ([arg]) => (arg as { data: { stato_ts?: string } }).data.stato_ts === "DA_INVIARE" &&
          (arg as { where: { id?: unknown } }).where.id !== undefined
      );
      expect(rollback).toBeUndefined();
      expect(consoleError).toHaveBeenCalledWith(
        "TS_ESITO_INCERTO",
        expect.objectContaining({ invoiceIds: [101] })
      );
      consoleError.mockRestore();
    });

    it("il recupero dei lock orfani esclude gli invii già avviati", async () => {
      mockPagamentoFindMany.mockResolvedValueOnce([createMockInvoice(101, 1)]);
      mockPagamentoUpdateMany.mockResolvedValue({ count: 1 });

      await inviaLottoFatture([101]);

      expect(mockPagamentoUpdateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            stato_ts: "IN_TRASMISSIONE",
            protocollo_ts: null,
            invio_avviato_ts: null,
          }),
        })
      );
    });

    const invioIncerto = {
      id: 300,
      n_fattura: 12,
      anno: 2026,
      stato_ts: "IN_TRASMISSIONE",
      protocollo_ts: null,
      data_invio_ts: new Date(Date.now() - 10 * MINUTO),
      invio_avviato_ts: new Date(Date.now() - 10 * MINUTO),
    };

    it("rifiuta lo sblocco senza conferma della verifica", async () => {
      mockPagamentoFindFirst.mockResolvedValueOnce({ ...invioIncerto });

      const result = await ripristinaFatturaPerReinvio(300);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Esito dell'invio incerto"),
      });
      expect(mockPagamentoUpdateMany).not.toHaveBeenCalled();
      expect(logAudit).not.toHaveBeenCalled();
    });

    it("ignora una conferma che non sia esattamente true", async () => {
      mockPagamentoFindFirst.mockResolvedValueOnce({ ...invioIncerto });

      const result = await ripristinaFatturaPerReinvio(300, {
        confermaEsitoVerificato: "si" as unknown as boolean,
      });

      expect(result).toHaveProperty("success", false);
      expect(mockPagamentoUpdateMany).not.toHaveBeenCalled();
    });

    it("con conferma sblocca l'intero lotto con una scrittura condizionata", async () => {
      mockPagamentoFindFirst.mockResolvedValueOnce({ ...invioIncerto });
      mockPagamentoUpdateMany.mockResolvedValueOnce({ count: 3 });

      const result = await ripristinaFatturaPerReinvio(300, { confermaEsitoVerificato: true });

      expect(result).toEqual({
        success: true,
        message: 'Lotto sbloccato: 3 fatture riportate su "Da Inviare".',
      });
      expect(mockPagamentoUpdateMany).toHaveBeenCalledWith({
        where: {
          id_Utente: 1,
          stato_ts: "IN_TRASMISSIONE",
          protocollo_ts: null,
          data_invio_ts: invioIncerto.data_invio_ts,
          invio_avviato_ts: { lt: expect.any(Date) },
        },
        data: {
          stato_ts: "DA_INVIARE",
          protocollo_ts: null,
          data_invio_ts: null,
          invio_avviato_ts: null,
        },
      });
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ esitoIncertoConfermato: true, numFatture: 3 }),
        })
      );
    });

    it("rifiuta lo sblocco confermato se l'invio è partito da poco", async () => {
      mockPagamentoFindFirst.mockResolvedValueOnce({
        ...invioIncerto,
        data_invio_ts: new Date(Date.now() - 6 * MINUTO),
        invio_avviato_ts: new Date(Date.now() - 1 * MINUTO),
      });

      const result = await ripristinaFatturaPerReinvio(300, { confermaEsitoVerificato: true });

      expect(result).toEqual({
        success: false,
        error: "Trasmissione in corso: riprova tra qualche minuto.",
      });
      expect(mockPagamentoUpdateMany).not.toHaveBeenCalled();
    });

    it("con count 0 non sblocca nulla e non scrive l'audit", async () => {
      mockPagamentoFindFirst.mockResolvedValueOnce({ ...invioIncerto });
      mockPagamentoUpdateMany.mockResolvedValueOnce({ count: 0 });

      const result = await ripristinaFatturaPerReinvio(300, { confermaEsitoVerificato: true });

      expect(result).toHaveProperty("success", false);
      expect(logAudit).not.toHaveBeenCalled();
    });
  });
});
