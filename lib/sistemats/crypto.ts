import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_CERT_PATH = path.join(process.cwd(), "certs", "SanitelCF.cer");
const MOCK_CERT_PATH = path.join(process.cwd(), "certs", "mock_sanitelcf.cer");

/**
 * Carica la chiave pubblica dal certificato X.509 ministeriale (DER binario o PEM).
 */
export function loadPublicKeyFromCert(certPath?: string): crypto.KeyObject {
  const targetPath = certPath || (fs.existsSync(DEFAULT_CERT_PATH) ? DEFAULT_CERT_PATH : MOCK_CERT_PATH);

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Certificato X.509 non trovato al percorso: ${targetPath}`);
  }

  const certBytes = fs.readFileSync(targetPath);
  try {
    const cert = new crypto.X509Certificate(certBytes);
    return cert.publicKey;
  } catch (error) {
    throw new Error(`Impossibile leggere il certificato X.509 da ${targetPath}: ${error}`);
  }
}

/**
 * Cifra una stringa (es. PinCode o Codice Fiscale cittadino) con la chiave pubblica RSA
 * del certificato Sogei specificato, con padding PKCS#1 v1.5 e codifica Base64.
 */
export function encryptRsaPkcs1(data: string, certPath?: string): string {
  if (!data) return "";

  const publicKey = loadPublicKeyFromCert(certPath);

  const ciphertext = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(data, "utf8")
  );

  return ciphertext.toString("base64");
}

/**
 * Decifra un payload Base64 con la chiave privata RSA specificata (usata nei test unitari).
 */
export function decryptRsaPkcs1(b64Ciphertext: string, privateKeyPemOrPath: string): string {
  if (!b64Ciphertext) return "";

  let keyData = privateKeyPemOrPath;
  if (fs.existsSync(privateKeyPemOrPath)) {
    keyData = fs.readFileSync(privateKeyPemOrPath, "utf8");
  }

  const decrypted = crypto.privateDecrypt(
    {
      key: keyData,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(b64Ciphertext, "base64")
  );

  return decrypted.toString("utf8");
}
