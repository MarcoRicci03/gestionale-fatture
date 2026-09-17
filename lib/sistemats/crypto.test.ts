import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decryptRsaPkcs1, encryptRsaPkcs1, loadPublicKeyFromCert } from "./crypto";

const MOCK_CERT = path.join(process.cwd(), "certs", "mock_sanitelcf.cer");
const MOCK_KEY = path.join(process.cwd(), "certs", "mock_sanitelcf.key");
const SANITEL_CERT = path.join(process.cwd(), "certs", "SanitelCF.cer");

describe("crypto — cifratura RSA PKCS#1 v1.5", () => {
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
});
