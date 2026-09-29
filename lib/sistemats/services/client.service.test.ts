import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encryptCredential, decryptCredential, needsReencryption } from "@/lib/sistemats/vault";

// P026: getClientForUser ricifra con la chiave primaria le credenziali
// decifrabili solo con una chiave di fallback. Vault reale, prisma mockato.

const mockSettingsFindUnique = vi.fn();
const mockSettingsUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    impostazioniSistemaTs: {
      findUnique: (...a: unknown[]) => mockSettingsFindUnique(...a),
      update: (...a: unknown[]) => mockSettingsUpdate(...a),
    },
    utente: {
      findUnique: vi.fn(async () => ({ cf: "RSSMRA80A01H501U", pIva: "12345678901" })),
    },
  },
}));

const { getClientForUser } = await import("./client.service");

const VECCHIA = "chiave-vecchia-di-almeno-32-caratteri-sicura-123";
const NUOVA = "chiave-nuova-di-almeno-32-caratteri-sicura-456";

function impostazioni(passwordEncrypted: string, pincodeEncrypted: string) {
  return {
    id_Utente: 3,
    username: "u",
    passwordEncrypted,
    pincodeEncrypted,
    codiceRegione: "000",
    codiceAsl: "000",
    codiceStruttura: null,
  };
}

describe("getClientForUser — ricifratura dopo la rotazione della chiave (P026)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsUpdate.mockResolvedValue({});
  });
  afterEach(() => vi.unstubAllEnvs());

  it("ricifra con la chiave primaria solo le credenziali cifrate con una chiave di fallback", async () => {
    vi.stubEnv("TS_ENCRYPTION_SECRET", VECCHIA);
    const passwordVecchia = encryptCredential("password-ts");
    vi.stubEnv("TS_ENCRYPTION_SECRET", NUOVA);
    vi.stubEnv("TS_ENCRYPTION_FALLBACK_SECRETS", VECCHIA);
    const pincodeNuovo = encryptCredential("pin-ts");
    mockSettingsFindUnique.mockResolvedValueOnce(impostazioni(passwordVecchia, pincodeNuovo));

    await getClientForUser(3);

    expect(mockSettingsUpdate).toHaveBeenCalledTimes(1);
    const { where, data } = mockSettingsUpdate.mock.calls[0][0];
    expect(where).toEqual({ id_Utente: 3 });
    expect(Object.keys(data)).toEqual(["passwordEncrypted"]);
    expect(needsReencryption(data.passwordEncrypted)).toBe(false);
    expect(decryptCredential(data.passwordEncrypted)).toBe("password-ts");
  });

  it("non scrive nulla se le credenziali sono già cifrate con la chiave primaria", async () => {
    vi.stubEnv("TS_ENCRYPTION_SECRET", NUOVA);
    mockSettingsFindUnique.mockResolvedValueOnce(
      impostazioni(encryptCredential("password-ts"), encryptCredential("pin-ts"))
    );

    await getClientForUser(3);

    expect(mockSettingsUpdate).not.toHaveBeenCalled();
  });

  it("se la scrittura fallisce restituisce comunque il client", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("TS_ENCRYPTION_SECRET", VECCHIA);
    const passwordVecchia = encryptCredential("password-ts");
    const pincodeVecchio = encryptCredential("pin-ts");
    vi.stubEnv("TS_ENCRYPTION_SECRET", NUOVA);
    vi.stubEnv("TS_ENCRYPTION_FALLBACK_SECRETS", VECCHIA);
    mockSettingsFindUnique.mockResolvedValueOnce(impostazioni(passwordVecchia, pincodeVecchio));
    mockSettingsUpdate.mockRejectedValueOnce(new Error("DB down"));

    const res = await getClientForUser(3);

    expect(res.user).toEqual({ cf: "RSSMRA80A01H501U", pIva: "12345678901" });
  });
});
