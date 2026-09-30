import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_CERT_PATH = path.join(process.cwd(), "certs", "SanitelCF.cer");
const MOCK_CERT_PATH = path.join(process.cwd(), "certs", "mock_sanitelcf.cer");

// Cache in-memory delle chiavi pubbliche X.509 indicizzate per percorso del file
const certCache = new Map<string, crypto.KeyObject>();
// Avviso del ripiego sul certificato di test emesso una sola volta (CR-08).
let mockFallbackWarned = false;

/**
 * Pulisce la cache delle chiavi pubbliche in memoria (usata nei test o in caso di rinnovo certificato).
 */
export function clearPublicKeyCache(): void {
  certCache.clear();
  mockFallbackWarned = false;
}

// CR-08: senza certificato ufficiale, in produzione PIN e CF finirebbero
// cifrati con il certificato di test: Sogei scarterebbe gli invii con errori
// fuorvianti (PIN errato, CF invalidi). Lì si blocca con un errore esplicito;
// fuori dalla produzione il ripiego sul mock resta, ma segnalato.
// Un certPath esplicito è usato così com'è.
function resolveCertPath(certPath?: string): string {
  if (certPath) return certPath;
  if (fs.existsSync(DEFAULT_CERT_PATH)) return DEFAULT_CERT_PATH;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[BLOCCO DI SICUREZZA] Certificato Sogei certs/SanitelCF.cer non trovato: in produzione non è consentito ripiegare sul certificato di test."
    );
  }

  if (!mockFallbackWarned) {
    mockFallbackWarned = true;
    console.warn(
      `Certificato Sogei ${DEFAULT_CERT_PATH} non trovato: uso il certificato di test ${MOCK_CERT_PATH}.`
    );
  }
  return MOCK_CERT_PATH;
}

/**
 * Carica la chiave pubblica dal certificato X.509 ministeriale (DER binario o PEM).
 * Utilizza una cache in-memory per evitare I/O sincrono su disco e parsing ripetuto ad ogni documento.
 */
export function loadPublicKeyFromCert(certPath?: string): crypto.KeyObject {
  const targetPath = resolveCertPath(certPath);

  const cachedKey = certCache.get(targetPath);
  if (cachedKey) {
    return cachedKey;
  }

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Certificato X.509 non trovato al percorso: ${targetPath}`);
  }

  const certBytes = fs.readFileSync(targetPath);
  try {
    const cert = new crypto.X509Certificate(certBytes);
    certCache.set(targetPath, cert.publicKey);
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
