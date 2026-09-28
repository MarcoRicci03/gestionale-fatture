import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  decryptRsaPkcs1,
  encryptRsaPkcs1,
  loadPublicKeyFromCert,
  clearPublicKeyCache,
} from "./crypto";

const MOCK_CERT = path.join(process.cwd(), "certs", "mock_sanitelcf.cer");
const MOCK_KEY = path.join(process.cwd(), "certs", "mock_sanitelcf.key");
const SANITEL_CERT = path.join(process.cwd(), "certs", "SanitelCF.cer");

describe("crypto — cifratura RSA PKCS#1 v1.5", () => {
  beforeEach(() => {
    clearPublicKeyCache();
    vi.restoreAllMocks();
  });

  it.skipIf(!fs.existsSync(SANITEL_CERT))("carica la chiave pubblica dal certificato ufficiale SanitelCF.cer (DER)", () => {
    const key = loadPublicKeyFromCert(SANITEL_CERT);
    expect(key).toBeDefined();
    expect(key.asymmetricKeyType).toBe("rsa");
  });

  it("cifra e decifra con successo con la coppia di chiavi mock", () => {
    const cf = "RSSMRA80A01H501Z";
    const encryptedB64 = encryptRsaPkcs1(cf, MOCK_CERT);

    expect(encryptedB64).toBeDefined();
    expect(typeof encryptedB64).toBe("string");
    expect(encryptedB64).not.toBe(cf);

    const decrypted = decryptRsaPkcs1(encryptedB64, MOCK_KEY);
    expect(decrypted).toBe(cf);
  });

  it.skipIf(!fs.existsSync(SANITEL_CERT))("cifra con successo con il certificato ministeriale SanitelCF.cer", () => {
    const pincode = "12345678";
    const encryptedB64 = encryptRsaPkcs1(pincode, SANITEL_CERT);

    expect(encryptedB64).toBeDefined();
    expect(encryptedB64.length).toBeGreaterThan(50);
  });

  describe("memoizzazione in-memory certificato X.509 (PERF-01)", () => {
    it("memoizza la chiave pubblica ed evita letture duplicate da disco", () => {
      const readSpy = vi.spyOn(fs, "readFileSync");

      const key1 = loadPublicKeyFromCert(MOCK_CERT);
      const key2 = loadPublicKeyFromCert(MOCK_CERT);

      // Entrambe le chiamate restituiscono la medesima istanza
      expect(key1).toBe(key2);
      // fs.readFileSync deve essere stato invocato una sola volta
      expect(readSpy).toHaveBeenCalledTimes(1);
    });

    it("esegue una nuova lettura da disco dopo clearPublicKeyCache()", () => {
      const readSpy = vi.spyOn(fs, "readFileSync");

      const key1 = loadPublicKeyFromCert(MOCK_CERT);
      expect(readSpy).toHaveBeenCalledTimes(1);

      clearPublicKeyCache();

      const key2 = loadPublicKeyFromCert(MOCK_CERT);
      expect(readSpy).toHaveBeenCalledTimes(2);
      expect(key1).not.toBe(key2);
    });

    it("su 100 cifrature consecutive invoca fs.readFileSync una sola volta", () => {
      const readSpy = vi.spyOn(fs, "readFileSync");

      for (let i = 0; i < 100; i++) {
        const encrypted = encryptRsaPkcs1(`RSSMRA80A01H501${i % 10}`, MOCK_CERT);
        expect(encrypted).toBeTruthy();
      }

      expect(readSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe("crypto — scelta del certificato (CR-08)", () => {
  const DEFAULT_CERT = path.join(process.cwd(), "certs", "SanitelCF.cer");

  beforeEach(() => {
    clearPublicKeyCache();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  function senzaCertificatoUfficiale() {
    const realExists = fs.existsSync;
    vi.spyOn(fs, "existsSync").mockImplementation((p) =>
      p === DEFAULT_CERT ? false : realExists(p)
    );
  }

  it("in produzione, senza certificato ufficiale, blocca invece di usare il mock", () => {
    vi.stubEnv("NODE_ENV", "production");
    senzaCertificatoUfficiale();

    expect(() => loadPublicKeyFromCert()).toThrow(/\[BLOCCO DI SICUREZZA\].*SanitelCF\.cer/);
  });

  it("in produzione un certPath esplicito resta valido", () => {
    vi.stubEnv("NODE_ENV", "production");
    senzaCertificatoUfficiale();

    expect(loadPublicKeyFromCert(MOCK_CERT).asymmetricKeyType).toBe("rsa");
  });

  it("fuori dalla produzione ripiega sul mock e lo segnala una sola volta", () => {
    vi.stubEnv("NODE_ENV", "development");
    senzaCertificatoUfficiale();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const key1 = loadPublicKeyFromCert();
    const key2 = loadPublicKeyFromCert();

    expect(key1).toBe(key2);
    expect(key1).toBe(loadPublicKeyFromCert(MOCK_CERT));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
