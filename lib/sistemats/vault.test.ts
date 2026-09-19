import { describe, expect, it, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  decryptCredential,
  encryptCredential,
  needsReencryption,
  CURRENT_KEY_VERSION,
} from "./vault";

describe("vault — cifratura AES-256-GCM a riposo con key versioning e rotation (SEC-05)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cifra e decifra correttamente una stringa con prefisso di versione v1", () => {
    const secretText = "PinCode12345678!";
    const encrypted = encryptCredential(secretText);

    expect(encrypted).not.toBe(secretText);
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(CURRENT_KEY_VERSION);

    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(secretText);
  });

  it("decifra correttamente stringhe in formato legacy a 3 parti (iv:authTag:ciphertext)", () => {
    // Simuliamo un record cifrato prima dell'introduzione di v1
    const iv = crypto.randomBytes(12);
    const devSecret = "fallback-dev-secret-sistema-ts-never-use-in-production";
    const key = crypto.createHash("sha256").update(devSecret).digest();
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const plaintext = "legacy-password-123";
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const legacyCiphertext = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
    expect(legacyCiphertext.split(":")).toHaveLength(3);

    // Decifratura retrocompatibile
    expect(decryptCredential(legacyCiphertext)).toBe(plaintext);
  });

  it("gestisce stringhe vuote", () => {
    expect(encryptCredential("")).toBe("");
    expect(decryptCredential("")).toBe("");
  });

  it("lancia errore su payload cifrato corrotto o manomesso", () => {
    const valid = encryptCredential("segreto");
    const parts = valid.split(":");
    // Manomettiamo il ciphertext invertendo i bit del primo byte per garantire la corruzione
    const firstByte = parts[3].slice(0, 2);
    const flipped = (parseInt(firstByte, 16) ^ 0xff).toString(16).padStart(2, "0");
    const corrupted = `${parts[0]}:${parts[1]}:${parts[2]}:${flipped}${parts[3].slice(2)}`;

    expect(() => decryptCredential(corrupted)).toThrow();
  });

  it("lancia errore se la versione non è supportata", () => {
    const valid = encryptCredential("segreto");
    const parts = valid.split(":");
    const unsupported = `v99:${parts[1]}:${parts[2]}:${parts[3]}`;

    expect(() => decryptCredential(unsupported)).toThrowError(/Versione chiave non supportata: v99/);
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

  it("supporta la rotazione della chiave tramite TS_ENCRYPTION_FALLBACK_SECRETS", () => {
    const oldKey = "chiave-vecchia-di-almeno-32-caratteri-sicura-123";
    const newKey = "chiave-nuova-di-almeno-32-caratteri-sicura-456";

    // 1. Cifra con la vecchia chiave
    vi.stubEnv("TS_ENCRYPTION_SECRET", oldKey);
    const encryptedWithOldKey = encryptCredential("credenziale-da-ruotare");

    // 2. Ruota la chiave: imposta newKey come primaria, oldKey come fallback
    vi.stubEnv("TS_ENCRYPTION_SECRET", newKey);
    vi.stubEnv("TS_ENCRYPTION_FALLBACK_SECRETS", oldKey);

    // 3. Decifra: la primaria fallisce, ma il fallback consente di decifrare
    const decrypted = decryptCredential(encryptedWithOldKey);
    expect(decrypted).toBe("credenziale-da-ruotare");
  });

  it("needsReencryption identifica record legacy o cifrati con chiavi ruotate", () => {
    const oldKey = "chiave-vecchia-di-almeno-32-caratteri-sicura-123";
    const newKey = "chiave-nuova-di-almeno-32-caratteri-sicura-456";

    vi.stubEnv("TS_ENCRYPTION_SECRET", oldKey);
    const encryptedWithOldKey = encryptCredential("test-reencrypt");

    // Attualmente cifrato con oldKey: per oldKey non serve reencryption
    expect(needsReencryption(encryptedWithOldKey)).toBe(false);

    // Ruotiamo la chiave
    vi.stubEnv("TS_ENCRYPTION_SECRET", newKey);
    vi.stubEnv("TS_ENCRYPTION_FALLBACK_SECRETS", oldKey);

    // Con la nuova chiave, il record cifrato con oldKey richiede reencryption
    expect(needsReencryption(encryptedWithOldKey)).toBe(true);

    // Un nuovo ciphertext prodotto con newKey non richiede reencryption
    const encryptedWithNewKey = encryptCredential("test-nuovo");
    expect(needsReencryption(encryptedWithNewKey)).toBe(false);

    // Un formato legacy a 3 parti richiede sempre reencryption
    const legacyFormat = "010203:040506:070809";
    expect(needsReencryption(legacyFormat)).toBe(true);

    // Stringa vuota
    expect(needsReencryption("")).toBe(false);
  });
});
