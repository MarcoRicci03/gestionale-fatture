import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { Prisma } from "@prisma/client";

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
const mockPazienteFindFirst = vi.fn();
const mockPazienteDelete = vi.fn();
const mockPagamentoCount = vi.fn();

const mockTransaction = vi.fn(async (cb: (tx: unknown) => unknown) => {
  const tx = {
    paziente: {
      findFirst: (...args: unknown[]) => mockPazienteFindFirst(...args),
      delete: (...args: unknown[]) => mockPazienteDelete(...args),
    },
    pagamento: {
      count: (...args: unknown[]) => mockPagamentoCount(...args),
    },
  };
  return cb(tx);
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paziente: {
      findFirst: (...args: unknown[]) => mockPazienteFindFirst(...args),
      delete: (...args: unknown[]) => mockPazienteDelete(...args),
    },
    pagamento: {
      count: (...args: unknown[]) => mockPagamentoCount(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args as [(tx: unknown) => unknown]),
  },
}));

import { hardDeletePatient } from "./patients";

describe("lib/actions/patients — hardDeletePatient transazionale e gestione vincoli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("elimina definitivamente il paziente ed esegue l'audit log quando non ci sono fatture collegate", async () => {
    mockPazienteFindFirst.mockResolvedValueOnce({
      id: 5,
      id_Utente: 1,
      archiviato: true,
      id_Pagante: 12,
    });
    mockPagamentoCount.mockResolvedValueOnce(0);
    mockPazienteDelete.mockResolvedValueOnce({ id: 5 });

    const res = await hardDeletePatient(5);

    expect(res).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockPazienteDelete).toHaveBeenCalledWith({
      where: { id: 5, id_Utente: 1 },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        azione: AUDIT_ACTIONS.PATIENT_DELETE,
        entita: "Paziente",
        entitaId: 5,
        meta: { id_Pagante: 12 },
      })
    );
  });

  it("blocca l'eliminazione se ci sono fatture collegate al paziente", async () => {
    mockPazienteFindFirst.mockResolvedValueOnce({
      id: 5,
      id_Utente: 1,
      archiviato: true,
      id_Pagante: 12,
    });
    mockPagamentoCount.mockResolvedValueOnce(3);

    const res = await hardDeletePatient(5);

    expect(res).toEqual({
      error: expect.stringContaining("ci sono 3 fattura/e collegata/e"),
    });
    expect(mockPazienteDelete).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("restituisce errore se il paziente non è trovato tra gli archiviati", async () => {
    mockPazienteFindFirst.mockResolvedValueOnce(null);

    const res = await hardDeletePatient(5);

    expect(res).toEqual({
      error: "Paziente non trovato tra gli archiviati",
    });
    expect(mockPazienteDelete).not.toHaveBeenCalled();
  });

  it("gestisce la violazione di vincolo foreign key (P2003) con messaggio esplicito", async () => {
    mockPazienteFindFirst.mockResolvedValueOnce({
      id: 5,
      id_Utente: 1,
      archiviato: true,
      id_Pagante: 12,
    });
    mockPagamentoCount.mockResolvedValueOnce(0);
    mockPazienteDelete.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("FK violation", {
        code: "P2003",
        clientVersion: "5.0.0",
      })
    );

    const res = await hardDeletePatient(5);

    expect(res).toEqual({
      error:
        "Impossibile eliminare: sono presenti record (fatture) collegati a questo paziente",
    });
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
