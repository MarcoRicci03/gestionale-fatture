import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard per GCM

const MIN_TS_SECRET_BYTES = 32;

const KNOWN_PLACEHOLDER_SECRETS = new Set([
  "change-me",
  "changeme",
  "secret",
  "password",
  "your-secret",
  "your-secret-key",
  "test",
  "test-secret",
  "fallback-dev-secret-sistema-ts-never-use-in-production",
]);

function getEncryptionKey(): Buffer {
  const isProduction = process.env.NODE_ENV === "production";
  const secret = process.env.TS_ENCRYPTION_SECRET;

  if (isProduction) {
    if (!secret || !secret.trim()) {
      throw new Error(
        "TS_ENCRYPTION_SECRET non è definita in ambiente di produzione: genera una chiave casuale di almeno 32 caratteri (es. `openssl rand -base64 48`)."
      );
    }

    const normalized = secret.trim().toLowerCase();
    if (KNOWN_PLACEHOLDER_SECRETS.has(normalized)) {
      throw new Error(
        `TS_ENCRYPTION_SECRET usa un valore segnaposto noto ("${secret}"): genera un segreto casuale, ad es. con \`openssl rand -base64 48\`.`
      );
    }

    const byteLength = new TextEncoder().encode(secret).length;
    if (byteLength < MIN_TS_SECRET_BYTES) {
      throw new Error(
        `TS_ENCRYPTION_SECRET è troppo corta (${byteLength} byte, minimo ${MIN_TS_SECRET_BYTES}): genera una chiave sicura, ad es. con \`openssl rand -base64 48\`.`
      );
    }

    return crypto.createHash("sha256").update(secret).digest();
  }

  // Sviluppo / test: usa TS_ENCRYPTION_SECRET se presente, altrimenti fallback locale fisso.
  // Nessun fallback su JWT_SECRET per evitare che una rotazione del token di sessione
  // renda illeggibili le credenziali ministeriali cifrate a database.
  const devSecret =
    secret || "fallback-dev-secret-sistema-ts-never-use-in-production";

  return crypto.createHash("sha256").update(devSecret).digest();
}

/**
 * Cifra una credenziale sensibile a riposo usando AES-256-GCM.
 * Formato restituito: "iv_hex:authTag_hex:ciphertext_hex"
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) return "";

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decifra una stringa cifrata con AES-256-GCM salvata nel database.
 */
export function decryptCredential(encryptedData: string): string {
  if (!encryptedData) return "";

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato credenziale cifrata non valido (atteso iv:tag:data)");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
