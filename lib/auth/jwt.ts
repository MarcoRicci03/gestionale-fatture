import { SignJWT, jwtVerify, decodeJwt } from "jose";

// Con HS256 chiunque conosca JWT_SECRET può forgiare un token valido per
// QUALSIASI utente (basta impostare `sub` a piacere): un segreto corto o un
// valore segnaposto lasciato per errore (es. il "change-me" di
// .env.prod.example) equivale a non avere autenticazione. Per questo, oltre
// alla sola presenza, si verifica lunghezza minima e assenza dai valori
// segnaposto noti — fallendo l'avvio dell'app piuttosto che accettare un
// segreto debole in silenzio.
const MIN_JWT_SECRET_BYTES = 32;

const KNOWN_PLACEHOLDER_SECRETS = new Set([
  "change-me",
  "changeme",
  "secret",
  "password",
  "your-secret",
  "your-secret-key",
  "test",
  "test-secret",
  "jwt-secret",
  "jwt_secret",
]);

// Esportata (non solo interna) per essere testabile direttamente da
// scripts/verify-jwt-secret-strength.ts senza dover far ripartire l'intero
// processo con un JWT_SECRET diverso: la validazione vera e propria avviene
// comunque una sola volta, al caricamento del modulo (sotto).
export function assertStrongJwtSecret(value: string): void {
  const normalized = value.trim().toLowerCase();

  if (KNOWN_PLACEHOLDER_SECRETS.has(normalized)) {
    throw new Error(
      `JWT_SECRET usa un valore segnaposto noto ("${value}"): genera un segreto casuale, ad es. con \`openssl rand -base64 48\`.`
    );
  }

  const byteLength = new TextEncoder().encode(value).length;
  if (byteLength < MIN_JWT_SECRET_BYTES) {
    throw new Error(
      `JWT_SECRET troppo corto (${byteLength} byte, minimo ${MIN_JWT_SECRET_BYTES}): genera un segreto casuale, ad es. con \`openssl rand -base64 48\`.`
    );
  }
}

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET non configurato nelle variabili d'ambiente");
}
assertStrongJwtSecret(secret);

const encodedSecret = new TextEncoder().encode(secret);

export type SessionPayload = {
  sub: string;
  tokenVersion: number;
};

const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 giorni

// tokenVersion (Utente.tokenVersion) va firmato nel JWT insieme a sub: è ciò
// che permette a getSession() (lib/auth/session.ts) di rilevare e rifiutare
// un token emesso PRIMA dell'ultimo cambio/reset password, anche se non è
// ancora scaduto — vedi il commento su Utente.tokenVersion in schema.prisma.
export async function signSession(
  userId: number,
  tokenVersion: number
): Promise<string> {
  return new SignJWT({ sub: String(userId), tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "7d")
    .sign(encodedSecret);
}

// Deriva la durata del cookie di sessione (lib/auth/session.ts) direttamente
// dal token JWT già firmato, invece di ri-parsare JWT_EXPIRES_IN con un
// parser separato: jose.setExpirationTime accetta molti più formati (es.
// "2 hours", "1 year") di quanti un parser locale ne riconoscesse, quindi
// derivare dal token reale è l'unico modo che garantisce che cookie e JWT
// scadano sempre insieme, qualunque sia il formato usato in JWT_EXPIRES_IN.
// Usa decodeJwt (non verificato, legge il payload senza controllare la
// firma): sicuro SOLO perché non è esportata, quindi l'unico chiamante
// possibile è signSessionWithMaxAge qui sotto, che le passa sempre un token
// appena firmato da questo stesso server, mai un token arbitrario letto da
// un client (vedi SEC-17 in SECURITY_AUDIT.md — prima un futuro chiamante
// avrebbe potuto passarle un token non verificato, dato che la funzione era
// esportata e accettava una stringa qualsiasi).
function getTokenMaxAgeSeconds(token: string): number {
  const { exp, iat } = decodeJwt(token);
  if (typeof exp !== "number" || typeof iat !== "number") {
    return DEFAULT_SESSION_MAX_AGE_SECONDS;
  }
  return Math.max(0, exp - iat);
}

// Unico modo, per chi è fuori da questo modulo, di ottenere un token insieme
// alla sua durata: firma e calcolo restano accoppiati qui, così
// getTokenMaxAgeSeconds non ha mai bisogno di essere esposta con un token
// arbitrario come parametro.
export async function signSessionWithMaxAge(
  userId: number,
  tokenVersion: number
): Promise<{ token: string; maxAgeSeconds: number }> {
  const token = await signSession(userId, tokenVersion);
  return { token, maxAgeSeconds: getTokenMaxAgeSeconds(token) };
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret, {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.tokenVersion !== "number") {
      return null;
    }
    return { sub: payload.sub, tokenVersion: payload.tokenVersion };
  } catch {
    return null;
  }
}
