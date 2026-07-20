import { SignJWT, jwtVerify, decodeJwt } from "jose";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET non configurato nelle variabili d'ambiente");
}

const encodedSecret = new TextEncoder().encode(secret);

export type SessionPayload = {
  sub: string;
};

const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 giorni

export async function signSession(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
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
// Usa decodeJwt (non verificato): sicuro solo perché l'unico chiamante
// (setSessionCookie) passa sempre un token appena firmato da questo server
// via signSession, mai un token arbitrario letto da un client.
export function getTokenMaxAgeSeconds(token: string): number {
  const { exp, iat } = decodeJwt(token);
  if (typeof exp !== "number" || typeof iat !== "number") {
    return DEFAULT_SESSION_MAX_AGE_SECONDS;
  }
  return Math.max(0, exp - iat);
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret, {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string") {
      return null;
    }
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
