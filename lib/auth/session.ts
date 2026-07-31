import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signSessionWithMaxAge, verifySession } from "./jwt";
import type { Utente } from "@prisma/client";

const COOKIE_NAME = "session_token";

export type Session = Pick<
  Utente,
  | "id"
  | "username"
  | "nome"
  | "cognome"
  | "isAdmin"
  | "abilitato"
  | "specializzazione"
  | "mustChangePassword"
>;

// cache() (React) deduplica per la durata della singola richiesta/render:
// requireSession()/requireUserId()/requireAdmin()/getUserIdOrNull() sono
// chiamate una volta per ciascuna funzione del data layer che serve una
// pagina (PERF-01) — senza questo, ogni chiamata era una
// `SELECT * FROM utenti WHERE id = $1` identica (5 per /invoices, 4 per
// /patients, ...). Non introduce caching tra richieste diverse: i controlli
// su `abilitato` e `tokenVersion` restano verificati una volta per
// richiesta, esattamente come prima.
export const getSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = await verifySession(token);
  if (!payload) {
    return null;
  }

  const userId = Number(payload.sub);
  if (Number.isNaN(userId)) {
    return null;
  }

  const user = await prisma.utente.findUnique({
    where: { id: userId },
  });

  if (!user || !user.abilitato) {
    return null;
  }

  // Un token firmato prima dell'ultimo cambio/reset password porta un
  // tokenVersion ormai superato: va trattato come sessione invalidata, non
  // come utente valido (vedi il commento su Utente.tokenVersion in
  // schema.prisma).
  if (payload.tokenVersion !== user.tokenVersion) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    nome: user.nome,
    cognome: user.cognome,
    isAdmin: user.isAdmin,
    abilitato: user.abilitato,
    specializzazione: user.specializzazione,
    mustChangePassword: user.mustChangePassword,
  };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireUserId(): Promise<number> {
  const session = await requireSession();
  return session.id;
}

// Per gli handler in app/api/**/route.ts: a differenza di requireUserId()
// (che fa redirect("/login"), producendo un 307 con corpo HTML — una
// risposta priva di senso per un client API), qui l'assenza di sessione
// viene restituita come null, così il chiamante può rispondere con uno
// status 401 esplicito.
export async function getUserIdOrNull(): Promise<number | null> {
  const session = await getSession();
  return session ? session.id : null;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.isAdmin) {
    redirect("/dashboard");
  }
  return session;
}

// maxAgeSeconds va sempre calcolato da signSessionWithMaxAge (lib/auth/jwt.ts)
// insieme al token: non esiste un modo di ottenerlo separatamente da un
// token arbitrario, per costruzione.
async function setSessionCookie(
  token: string,
  maxAgeSeconds: number
): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

// Firma e imposta il cookie di sessione per (userId, tokenVersion). Usato dal
// login e da changePassword: in changePassword il tokenVersion è già stato
// incrementato in DB, quindi questa chiamata riallinea subito il cookie della
// sessione corrente al nuovo valore, mentre ogni altro token firmato in
// precedenza (es. un cookie rubato) resta con il tokenVersion vecchio e viene
// respinto da getSession al primo controllo.
export async function createSessionCookie(
  userId: number,
  tokenVersion: number
): Promise<void> {
  const { token, maxAgeSeconds } = await signSessionWithMaxAge(userId, tokenVersion);
  await setSessionCookie(token, maxAgeSeconds);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
