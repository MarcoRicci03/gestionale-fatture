import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const mockPagamentoUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pagamento: {
      updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
    },
  },
}));

// DRY-05: Verifica statica e funzionale della centralizzazione
// della logica di rollback dello stato trasmissione Sistema TS.

const SERVICE_PATH = join(
  __dirname,
  "..",
  "lib",
  "sistemats",
  "services",
  "transmission.service.ts"
);

describe("DRY-05: Analisi statica DRY su transmission.service.ts", () => {
  const source = readFileSync(SERVICE_PATH, "utf-8");

  it("definisce ed esporta la funzione rollbackStatoTrasmissione", () => {
    expect(source).toMatch(/export\s+async\s+function\s+rollbackStatoTrasmissione\s*\(/);
  });

  it("utilizza rollbackStatoTrasmissione in tutti i punti di errore di inviaLottoFattureService", () => {
    const fnBodyStart = source.indexOf("async function inviaLottoFattureService");
    expect(fnBodyStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnBodyStart);

    // Conta le chiamate a rollbackStatoTrasmissione all'interno di inviaLottoFattureService
    const calls = fnBody.match(/rollbackStatoTrasmissione\s*\(/g);
    expect(calls).not.toBeNull();
    // I 6 punti: CF non valido, importo non valido, data pagamento futura, bollo mancante (ARCH-06), scarto Sogei, blocco catch
    expect(calls!.length).toBe(6);
  });

  it("non contiene query updateMany duplicate per il rollback a DA_INVIARE dentro inviaLottoFattureService", () => {
    const fnBodyStart = source.indexOf("async function inviaLottoFattureService");
    const fnBody = source.slice(fnBodyStart);

    // Dentro inviaLottoFattureService, l'unica query con data.stato_ts = "DA_INVIARE"
    // deve essere la query di recupero automatico degli stale lock a inizio funzione.
    const directRollbackQueries = fnBody.match(/data:\s*\{[\s\S]*?stato_ts:\s*"DA_INVIARE"/g) ?? [];
    expect(directRollbackQueries.length).toBe(1);
  });
});

describe("DRY-05: Test unitari funzionali su rollbackStatoTrasmissione", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("esegue updateMany con lockTimestamp quando fornito", async () => {
    const { rollbackStatoTrasmissione } = await import(
      "../lib/sistemats/services/transmission.service"
    );

    mockPagamentoUpdateMany.mockResolvedValueOnce({ count: 2 });
    const lockDate = new Date("2026-09-24T01:00:00.000Z");

    await rollbackStatoTrasmissione([10, 20], 1, lockDate);

    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [10, 20] },
        id_Utente: 1,
        stato_ts: "IN_TRASMISSIONE",
        data_invio_ts: lockDate,
      },
      data: {
        stato_ts: "DA_INVIARE",
        data_invio_ts: null,
      },
    });
  });

  it("esegue updateMany senza vincolo data_invio_ts quando lockTimestamp è omesso", async () => {
    const { rollbackStatoTrasmissione } = await import(
      "../lib/sistemats/services/transmission.service"
    );

    mockPagamentoUpdateMany.mockResolvedValueOnce({ count: 1 });

    await rollbackStatoTrasmissione([30], 2);

    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [30] },
        id_Utente: 2,
        stato_ts: "IN_TRASMISSIONE",
      },
      data: {
        stato_ts: "DA_INVIARE",
        data_invio_ts: null,
      },
    });
  });

  it("ritorna immediatamente senza interrogare il DB se candidateIds è vuoto", async () => {
    const { rollbackStatoTrasmissione } = await import(
      "../lib/sistemats/services/transmission.service"
    );

    await rollbackStatoTrasmissione([], 1);

    expect(mockPagamentoUpdateMany).not.toHaveBeenCalled();
  });
});
