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
const mockPagamentoFindMany = vi.fn();
const mockPagamentoUpdate = vi.fn();

const mockTransaction = vi.fn(async (cb: (tx: unknown) => unknown) => {
  const tx = {
    pagante: {
      update: (...args: unknown[]) => mockPaganteUpdate(...args),
      create: (...args: unknown[]) => mockPaganteCreate(...args),
    },
    pagamento: {
      findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
      update: (...args: unknown[]) => mockPagamentoUpdate(...args),
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
    },
    pagamento: {
      findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
      update: (...args: unknown[]) => mockPagamentoUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args as [(tx: unknown) => unknown]),
  },
}));

import { updatePayer, createPayer } from "./payers";

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
    expect(mockPagamentoUpdate).not.toHaveBeenCalled();
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

    expect(mockPagamentoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 50 },
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
});
