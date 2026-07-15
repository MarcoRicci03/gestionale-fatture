import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET non configurato nelle variabili d'ambiente");
}

const encodedSecret = new TextEncoder().encode(secret);

export type SessionPayload = {
  sub: string;
};

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
