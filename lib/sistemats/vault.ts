import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard per GCM

const MIN_TS_SECRET_BYTES = 32;

export const CURRENT_KEY_VERSION = "v1";

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

function validateSecret(secret: string, secretName: string, isProduction: boolean): void {
  if (isProduction) {
    if (!secret || !secret.trim()) {
      throw new Error(
        `${secretName} non è definita in ambiente di produzione: genera una chiave casuale di almeno 32 caratteri (es. \`openssl rand -base64 48\`).`
      );
    }

    const normalized = secret.trim().toLowerCase();
    if (KNOWN_PLACEHOLDER_SECRETS.has(normalized)) {
      throw new Error(
        `${secretName} usa un valore segnaposto noto ("${secret}"): genera un segreto casuale, ad es. con \`openssl rand -base64 48\`.`
      );
    }

    const byteLength = new TextEncoder().encode(secret).length;
    if (byteLength < MIN_TS_SECRET_BYTES) {
      throw new Error(
        `${secretName} è troppo corta (${byteLength} byte, minimo ${MIN_TS_SECRET_BYTES}): genera una chiave sicura, ad es. con \`openssl rand -base64 48\`.`
      );
    }
  }
}

function getPrimaryEncryptionKey(): Buffer {
  const isProduction = process.env.NODE_ENV === "production";
  const secret = process.env.TS_ENCRYPTION_SECRET;

  validateSecret(secret ?? "", "TS_ENCRYPTION_SECRET", isProduction);

  if (isProduction) {
    return crypto.createHash("sha256").update(secret!).digest();
  }

  // Sviluppo / test: usa TS_ENCRYPTION_SECRET se presente, altrimenti fallback locale fisso.
  // Nessun fallback su JWT_SECRET per evitare che una rotazione del token di sessione
  // renda illeggibili le credenziali ministeriali cifrate a database.
  const devSecret =
    secret || "fallback-dev-secret-sistema-ts-never-use-in-production";

  return crypto.createHash("sha256").update(devSecret).digest();
}

function getFallbackEncryptionKeys(): Buffer[] {
  const isProduction = process.env.NODE_ENV === "production";
  const fallbackEnv = process.env.TS_ENCRYPTION_FALLBACK_SECRETS;
  if (!fallbackEnv || !fallbackEnv.trim()) {
    return [];
  }

  const secrets = fallbackEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const keys: Buffer[] = [];
  for (let i = 0; i < secrets.length; i++) {
    const s = secrets[i];
    validateSecret(s, `TS_ENCRYPTION_FALLBACK_SECRETS[${i}]`, isProduction);
    keys.push(crypto.createHash("sha256").update(s).digest());
  }

  return keys;
}

function decryptWithKey(
  encrypted: Buffer,
  authTag: Buffer,
  iv: Buffer,
  key: Buffer
): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Cifra una credenziale sensibile a riposo usando AES-256-GCM.
 * Formato restituito: "v1:iv_hex:authTag_hex:ciphertext_hex" (SEC-05)
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) return "";

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getPrimaryEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${CURRENT_KEY_VERSION}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decifra una stringa cifrata con AES-256-GCM salvata nel database.
 * Supporta sia il formato versionato "v1:iv:tag:data" sia il formato legacy "iv:tag:data".
 * In caso di fallimento con la chiave primaria, tenta le chiavi secondarie in TS_ENCRYPTION_FALLBACK_SECRETS.
 */
export function decryptCredential(encryptedData: string): string {
  if (!encryptedData) return "";

  const parts = encryptedData.split(":");
  let ivHex: string;
  let authTagHex: string;
  let encryptedHex: string;

  if (parts.length === 4) {
    const [version, iv, tag, cipher] = parts;
    if (version !== CURRENT_KEY_VERSION) {
      throw new Error(`Versione chiave non supportata: ${version}`);
    }
    ivHex = iv;
    authTagHex = tag;
    encryptedHex = cipher;
  } else if (parts.length === 3) {
    // Retrocompatibilità: formato legacy v0 senza prefisso di versione
    [ivHex, authTagHex, encryptedHex] = parts;
  } else {
    throw new Error(
      "Formato credenziale cifrata non valido (atteso v1:iv:tag:data o iv:tag:data)"
    );
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const primaryKey = getPrimaryEncryptionKey();
  try {
    return decryptWithKey(encrypted, authTag, iv, primaryKey);
  } catch (primaryError) {
    const fallbackKeys = getFallbackEncryptionKeys();
    for (const fallbackKey of fallbackKeys) {
      try {
        return decryptWithKey(encrypted, authTag, iv, fallbackKey);
      } catch {
        // Tenta la chiave successiva
      }
    }
    throw primaryError;
  }
}

/**
 * Determina se un valore cifrato necessita di ri-cifratura con la chiave primaria corrente
 * (es. se è in formato legacy senza prefisso o se è decifrabile solo tramite fallback).
 */
export function needsReencryption(encryptedData: string): boolean {
  if (!encryptedData) return false;
  const parts = encryptedData.split(":");
  if (parts.length !== 4 || parts[0] !== CURRENT_KEY_VERSION) {
    return true;
  }

  try {
    const [, ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const primaryKey = getPrimaryEncryptionKey();
    decryptWithKey(encrypted, authTag, iv, primaryKey);
    return false;
  } catch {
    return true;
  }
}
