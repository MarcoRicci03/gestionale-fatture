import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET non configurato nelle variabili d'ambiente");
}

const encodedSecret = new TextEncoder().encode(secret);

export type SessionPayload = {
  sub: string;
};

const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 giorni

function parseDurationToSeconds(input: string): number {
  const match = input.trim().match(/^(\d+)\s*([smhdw])?$/i);
  if (!match) return DEFAULT_SESSION_MAX_AGE_SECONDS;

  const value = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
    w: 60 * 60 * 24 * 7,
  };
  return value * multipliers[unit];
}

// Usata per il maxAge del cookie di sessione (lib/auth/session.ts): deve
// restare in sync con la scadenza del JWT firmato da signSession, altrimenti
// il cookie sopravvive più o meno a lungo del token che contiene.
export function getSessionMaxAgeSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN;
  if (!raw) return DEFAULT_SESSION_MAX_AGE_SECONDS;
  return parseDurationToSeconds(raw);
}

export async function signSession(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "7d")
    .sign(encodedSecret);
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
