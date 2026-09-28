import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

// Mock auth session & IP
vi.mock("@/lib/auth/session", () => ({
  requireUserId: vi.fn(async () => 1),
}));

vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));

// Mock Next.js cache & audit
const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockLogAudit = vi.fn();
vi.mock("@/lib/audit/log", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

// Mock Prisma
const mockPaganteFindFirst = vi.fn();
const mockPaganteCreate = vi.fn();
const mockPaganteUpdate = vi.fn();
const mockPaganteDelete = vi.fn();
const mockPagamentoFindMany = vi.fn();
const mockPagamentoUpdate = vi.fn();
const mockPagamentoUpdateMany = vi.fn();
const mockPagamentoCount = vi.fn();
const mockPazienteCount = vi.fn();

const mockTransaction = vi.fn(async (cb: (tx: unknown) => unknown) => {
  const tx = {
    pagante: {
      findFirst: (...args: unknown[]) => mockPaganteFindFirst(...args),
      update: (...args: unknown[]) => mockPaganteUpdate(...args),
      create: (...args: unknown[]) => mockPaganteCreate(...args),
      delete: (...args: unknown[]) => mockPaganteDelete(...args),
    },
    pagamento: {
      findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
      update: (...args: unknown[]) => mockPagamentoUpdate(...args),
      updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
      count: (...args: unknown[]) => mockPagamentoCount(...args),
    },
    paziente: {
      count: (...args: unknown[]) => mockPazienteCount(...args),
    },
  };
  return cb(tx);
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pagante: {
      findFirst: (...args: unknown[]) => mockPaganteFindFirst(...args),
      create: (...args: unknown[]) => mockPaganteCreate(...args),
      update: (...args: unknown[]) => mockPaganteUpdate(...args),
      delete: (...args: unknown[]) => mockPaganteDelete(...args),
    },
    pagamento: {
      findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
      update: (...args: unknown[]) => mockPagamentoUpdate(...args),
      count: (...args: unknown[]) => mockPagamentoCount(...args),
    },
    paziente: {
      count: (...args: unknown[]) => mockPazienteCount(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args as [(tx: unknown) => unknown]),
  },
}));

import { Prisma } from "@prisma/client";
import { updatePayer, hardDeletePayer } from "./payers";

describe("lib/actions/payers — updatePayer con gestione propagazione", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPaganteFindFirst.mockResolvedValue(null);
  });

  const validData = {
    nome: "Mario",
    cognome: "Rossi",
    via: "Via Roma 10",
    citta: "Milano",
    cap: "20100",
    cf: "RSSMRA80A01H501U",
  };

  it("aggiorna solo il pagante quando propagaFattureInAttesa è false o non specificato", async () => {
    const res = await updatePayer(10, {
      ...validData,
      propagaFattureInAttesa: false,
    });

    expect(res).toEqual({ success: true });
    expect(mockPaganteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, id_Utente: 1, archiviato: false },
        data: expect.objectContaining({
          cf: "RSSMRA80A01H501U",
        }),
      })
    );
    expect(mockPagamentoFindMany).not.toHaveBeenCalled();
    expect(mockPagamentoUpdateMany).not.toHaveBeenCalled();
  });

  it("propaga i nuovi dati anagrafici alle bozze DA_INVIARE quando propagaFattureInAttesa è true", async () => {
    const draftInvoice = {
      id: 50,
      id_Utente: 1,
      id_Pagante: 10,
      stato_ts: "DA_INVIARE",
      snapshotAnagrafica: {
        pagante: {
          nome: "Vecchia",
          cognome: "Madre",
          via: "Via Vecchia 1",
          citta: "Milano",
          cap: "20100",
          cf: "MDRVCC70A41H501Z",
          piva: null,
        },
        paziente: { nome: "Figlio", cognome: "Rossi" },
      },
      pagante: { nome: "Mario", cognome: "Rossi" },
      paziente: { nome: "Figlio", cognome: "Rossi" },
    };

    mockPagamentoFindMany.mockResolvedValueOnce([draftInvoice]);

    const res = await updatePayer(10, {
      ...validData,
      propagaFattureInAttesa: true,
    });

    expect(res).toEqual({ success: true });
    expect(mockPagamentoFindMany).toHaveBeenCalledWith({
      where: {
        id_Utente: 1,
        id_Pagante: 10,
        stato_ts: "DA_INVIARE",
      },
      include: { pagante: true, paziente: true },
    });

    // CR-04: la where ricontrolla lo stato, così una bozza partita nel frattempo viene saltata.
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 50, stato_ts: "DA_INVIARE" },
        data: expect.objectContaining({
          snapshotAnagrafica: expect.objectContaining({
            pagante: expect.objectContaining({
              nome: "Mario",
              cognome: "Rossi",
              cf: "RSSMRA80A01H501U",
            }),
            paziente: expect.objectContaining({
              nome: "Figlio",
              cognome: "Rossi",
            }),
          }),
        }),
      })
    );

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        azione: AUDIT_ACTIONS.PAYER_UPDATE,
        meta: { propagaFattureInAttesa: true },
      })
    );
  });

  it("propaga i nuovi dati a bozze multiple concorrenzialmente (PERF-02)", async () => {
    const draft1 = {
      id: 51,
      id_Utente: 1,
      id_Pagante: 10,
      stato_ts: "DA_INVIARE",
      snapshotAnagrafica: {
        pagante: { nome: "Vecchio", cognome: "Rossi", cf: "RSSVCC70A01H501U" },
        paziente: { nome: "Figlio", cognome: "Rossi" },
      },
      pagante: { nome: "Mario", cognome: "Rossi" },
      paziente: { nome: "Figlio", cognome: "Rossi" },
    };
    const draft2 = {
      id: 52,
      id_Utente: 1,
      id_Pagante: 10,
      stato_ts: "DA_INVIARE",
      snapshotAnagrafica: {
        pagante: { nome: "Vecchio", cognome: "Rossi", cf: "RSSVCC70A01H501U" },
        paziente: { nome: "Figlio2", cognome: "Rossi" },
      },
      pagante: { nome: "Mario", cognome: "Rossi" },
      paziente: { nome: "Figlio2", cognome: "Rossi" },
    };

    mockPagamentoFindMany.mockResolvedValueOnce([draft1, draft2]);

    const res = await updatePayer(10, {
      ...validData,
      propagaFattureInAttesa: true,
    });

    expect(res).toEqual({ success: true });
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 51, stato_ts: "DA_INVIARE" } })
    );
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 52, stato_ts: "DA_INVIARE" } })
    );
  });
});

describe("lib/actions/payers — hardDeletePayer transazionale e gestione vincoli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("elimina definitivamente il pagante ed esegue l'audit log quando non ci sono fatture o pazienti attivi", async () => {
    mockPaganteFindFirst.mockResolvedValueOnce({ id: 10, archiviato: true });
    mockPagamentoCount.mockResolvedValueOnce(0); // fatture
    mockPazienteCount
      .mockResolvedValueOnce(0) // pazienti non archiviati
      .mockResolvedValueOnce(2); // pazienti archiviati collegati
    mockPaganteDelete.mockResolvedValueOnce({ id: 10 });

    const res = await hardDeletePayer(10);

    expect(res).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockPaganteDelete).toHaveBeenCalledWith({
      where: { id: 10, id_Utente: 1 },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        azione: AUDIT_ACTIONS.PAYER_DELETE,
        entita: "Pagante",
        entitaId: 10,
        meta: { pazientiEliminatiInCascata: 2 },
      })
    );
  });

  it("blocca l'eliminazione se ci sono fatture collegate", async () => {
    mockPaganteFindFirst.mockResolvedValueOnce({ id: 10, archiviato: true });
    mockPagamentoCount.mockResolvedValueOnce(2); // fatture
    mockPazienteCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const res = await hardDeletePayer(10);

    expect(res).toEqual({
      success: false,
      error: expect.stringContaining("ci sono 2 fattura/e collegata/e"),
    });
    expect(mockPaganteDelete).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("blocca l'eliminazione se ci sono pazienti non archiviati collegati", async () => {
    mockPaganteFindFirst.mockResolvedValueOnce({ id: 10, archiviato: true });
    mockPagamentoCount.mockResolvedValueOnce(0);
    mockPazienteCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const res = await hardDeletePayer(10);

    expect(res).toEqual({
      success: false,
      error: expect.stringContaining("1 paziente/i collegato/i non è/sono ancora archiviato/i"),
    });
    expect(mockPaganteDelete).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("gestisce la violazione di vincolo foreign key (P2003) con messaggio esplicito", async () => {
    mockPaganteFindFirst.mockResolvedValueOnce({ id: 10, archiviato: true });
    mockPagamentoCount.mockResolvedValueOnce(0);
    mockPazienteCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockPaganteDelete.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("FK violation", {
        code: "P2003",
        clientVersion: "5.0.0",
      })
    );

    const res = await hardDeletePayer(10);

    expect(res).toEqual({
      success: false,
      error:
        "Impossibile eliminare: sono presenti record (fatture o pazienti) collegati a questo pagante",
    });
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
