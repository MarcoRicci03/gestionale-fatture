import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

// P014: test di comportamento di changePassword e updateProfile.

const mockCreateSessionCookie = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ id: 7 })),
  createSessionCookie: (...a: unknown[]) => mockCreateSessionCookie(...a),
}));
vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));
const mockVerifyPassword = vi.fn();
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
  verifyPassword: (...a: unknown[]) => mockVerifyPassword(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockLogAudit = vi.fn();
vi.mock("@/lib/audit/log", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    utente: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

const { changePassword, updateProfile } = await import("./account");

const NUOVA = "Nuova-Password-Robusta-2026";
const cambio = { currentPassword: "vecchia-password", newPassword: NUOVA, confirmPassword: NUOVA };

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue({ id: 7, passwordHash: "hash-vecchio" });
});

describe("changePassword", () => {
  it("con la password attuale errata non modifica nulla", async () => {
    mockVerifyPassword.mockResolvedValueOnce(false);

    const res = await changePassword(cambio);

    expect(res).toEqual({ success: false, error: "Password attuale errata" });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("aggiorna la password, revoca le altre sessioni e riallinea il cookie corrente", async () => {
    mockVerifyPassword.mockResolvedValueOnce(true);
    mockUpdate.mockResolvedValueOnce({ tokenVersion: 4 });

    const res = await changePassword(cambio);

    expect(res).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        passwordHash: `hash:${NUOVA}`,
        tokenVersion: { increment: 1 },
        mustChangePassword: false,
      },
    });
    expect(mockCreateSessionCookie).toHaveBeenCalledWith(7, 4);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ azione: AUDIT_ACTIONS.ACCOUNT_PASSWORD_CHANGE, userId: 7 })
    );
  });

  it("rifiuta una nuova password debole prima di verificare quella attuale", async () => {
    const res = await changePassword({ ...cambio, newPassword: "corta", confirmPassword: "corta" });

    expect(res.success).toBe(false);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("updateProfile", () => {
  it("aggiorna solo il proprio profilo normalizzando i campi vuoti a null", async () => {
    const res = await updateProfile({
      nome: "  Anna ",
      cognome: "",
      pIva: "",
      cf: null,
      via: " Via Roma 1 ",
      citta: "",
      cap: "00100",
      provincia: "",
      titolo: "",
      specializzazione: "",
    });

    expect(res).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        nome: "Anna",
        cognome: null,
        pIva: null,
        cf: null,
        via: "Via Roma 1",
        citta: null,
        cap: "00100",
        provincia: null,
        titolo: null,
        specializzazione: null,
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ azione: AUDIT_ACTIONS.ACCOUNT_PROFILE_UPDATE, entitaId: 7 })
    );
  });

  it("rifiuta un codice fiscale non valido senza scrivere", async () => {
    const res = await updateProfile({ cf: "NONVALIDO" });

    expect(res).toEqual({ success: false, error: "Dati non validi" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
