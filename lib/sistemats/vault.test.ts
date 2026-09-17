import { describe, expect, it, vi, afterEach } from "vitest";
import { decryptCredential, encryptCredential } from "./vault";

describe("vault — cifratura AES-256-GCM a riposo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cifra e decifra correttamente una stringa", () => {
    const secretText = "PinCode12345678!";
    const encrypted = encryptCredential(secretText);

    expect(encrypted).not.toBe(secretText);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(secretText);
  });

  it("gestisce stringhe vuote", () => {
    expect(encryptCredential("")).toBe("");
    expect(decryptCredential("")).toBe("");
  });

  it("lancia errore su payload cifrato corrotto o manomesso", () => {
    const valid = encryptCredential("segreto");
    const parts = valid.split(":");
    // Manomettiamo il ciphertext
    const corrupted = `${parts[0]}:${parts[1]}:ff${parts[2].slice(2)}`;

    expect(() => decryptCredential(corrupted)).toThrow();
  });

  it("in produzione lancia errore se TS_ENCRYPTION_SECRET non è definita", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TS_ENCRYPTION_SECRET", "");

    expect(() => encryptCredential("test")).toThrowError(
      /TS_ENCRYPTION_SECRET non è definita in ambiente di produzione/
    );
  });

  it("in produzione rifiuta valori segnaposto noti (es. change-me)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TS_ENCRYPTION_SECRET", "change-me");

    expect(() => encryptCredential("test")).toThrowError(
      /TS_ENCRYPTION_SECRET usa un valore segnaposto noto/
    );
  });

  it("in produzione rifiuta chiavi più corte di 32 byte", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TS_ENCRYPTION_SECRET", "troppo-corta");

    expect(() => encryptCredential("test")).toThrowError(
      /TS_ENCRYPTION_SECRET è troppo corta/
    );
  });

  it("in produzione cifra correttamente con una chiave valida di almeno 32 caratteri", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "TS_ENCRYPTION_SECRET",
      "questo-e-un-segreto-lungo-e-sicuro-per-la-produzione-di-ts-123456"
    );

    const encrypted = encryptCredential("mia-password");
    expect(encrypted).not.toBe("mia-password");
    expect(decryptCredential(encrypted)).toBe("mia-password");
  });

  it("non usa JWT_SECRET come chiave di fallback quando TS_ENCRYPTION_SECRET è impostata", () => {
    vi.stubEnv(
      "TS_ENCRYPTION_SECRET",
      "chiave-di-cifratura-dedicata-ts-32-caratteri-minimi"
    );
    vi.stubEnv("JWT_SECRET", "chiave-jwt-diversa-32-caratteri-minimi-token");

    const encrypted = encryptCredential("test-indipendenza-jwt");

    // Ruotiamo JWT_SECRET: la decifratura deve funzionare ancora perché la chiave TS è indipendente!
    vi.stubEnv("JWT_SECRET", "nuova-chiave-jwt-ruotata-dopo-compromissione-sessioni");
    expect(decryptCredential(encrypted)).toBe("test-indipendenza-jwt");
  });
});
