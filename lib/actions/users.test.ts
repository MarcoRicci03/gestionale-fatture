import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

// P014: test di comportamento delle action di amministrazione utenti. Le
// invarianti statiche (verify-last-admin-guard, verify-session-token-version)
// controllano il sorgente; qui si controlla cosa succede davvero.

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: vi.fn(async () => ({ id: 1, isAdmin: true })),
}));
vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockLogAudit = vi.fn();
vi.mock("@/lib/audit/log", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();
const mockQueryRaw = vi.fn();
const utente = {
  findUnique: (...a: unknown[]) => mockFindUnique(...a),
  create: (...a: unknown[]) => mockCreate(...a),
  update: (...a: unknown[]) => mockUpdate(...a),
  count: (...a: unknown[]) => mockCount(...a),
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    utente,
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ utente, $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) })
    ),
  },
}));

const { createUser, updateUser, resetUserPassword, toggleUserEnabled } = await import("./users");

const PASSWORD = "Una-Password-Robusta-2026";
const datiUtente = { username: "mrossi", nome: "Mario", cognome: "Rossi", isAdmin: false, abilitato: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockReset();
  mockCount.mockReset();
  mockUpdate.mockResolvedValue({});
});

describe("createUser", () => {
  it("crea l'utente con password temporanea da cambiare e scrive l'audit", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ id: 5 });

    const res = await createUser({ ...datiUtente, password: PASSWORD });

    expect(res).toEqual({ success: true });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: "mrossi",
        passwordHash: `hash:${PASSWORD}`,
        mustChangePassword: true,
      }),
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ azione: AUDIT_ACTIONS.USER_CREATE, entitaId: 5 })
    );
  });

  it("rifiuta uno username già in uso senza creare nulla", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 9 });

    const res = await createUser({ ...datiUtente, password: PASSWORD });

    expect(res).toEqual({ success: false, error: "Username già in uso" });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("updateUser", () => {
  it("non permette all'admin di modificare il proprio account", async () => {
    const res = await updateUser(1, datiUtente);
    expect(res.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("blocca la revoca dell'ultimo admin abilitato", async () => {
    mockFindUnique
      .mockResolvedValueOnce(null) // username libero
      .mockResolvedValueOnce({ username: "mrossi", isAdmin: true, abilitato: true });
    mockCount.mockResolvedValueOnce(0);

    const res = await updateUser(2, { ...datiUtente, isAdmin: false });

    expect(res).toEqual({ success: false, error: "Deve restare almeno un amministratore abilitato" });
    expect(mockQueryRaw).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("revoca le sessioni se cambia lo username", async () => {
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ username: "vecchio", isAdmin: false, abilitato: true });

    const res = await updateUser(2, datiUtente);

    expect(res).toEqual({ success: true });
    expect(mockUpdate.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
  });

  it("non revoca le sessioni per una modifica che non tocca accesso o username", async () => {
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ username: "mrossi", isAdmin: false, abilitato: true });

    const res = await updateUser(2, { ...datiUtente, nome: "Marco" });

    expect(res).toEqual({ success: true });
    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("tokenVersion");
  });
});

describe("resetUserPassword", () => {
  it("imposta la nuova password come temporanea e revoca le sessioni", async () => {
    const res = await resetUserPassword(2, { password: PASSWORD });

    expect(res).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        passwordHash: `hash:${PASSWORD}`,
        tokenVersion: { increment: 1 },
        mustChangePassword: true,
      },
    });
  });

  it("non permette all'admin di resettare la propria password", async () => {
    const res = await resetUserPassword(1, { password: PASSWORD });
    expect(res.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("toggleUserEnabled", () => {
  it("disabilitando un utente revoca le sessioni", async () => {
    mockCount.mockResolvedValueOnce(1);

    const res = await toggleUserEnabled(3, false);

    expect(res).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { abilitato: false, tokenVersion: { increment: 1 } },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ azione: AUDIT_ACTIONS.USER_DISABLE })
    );
  });

  it("blocca la disabilitazione dell'ultimo admin abilitato", async () => {
    mockCount.mockResolvedValueOnce(0);

    const res = await toggleUserEnabled(3, false);

    expect(res).toEqual({ success: false, error: "Deve restare almeno un amministratore abilitato" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("riabilitando non tocca tokenVersion", async () => {
    const res = await toggleUserEnabled(3, true);

    expect(res).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 3 }, data: { abilitato: true } });
  });
});
