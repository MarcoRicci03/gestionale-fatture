import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession, getSessionMaxAgeSeconds } from "./jwt";
import type { Utente } from "@prisma/client";

const COOKIE_NAME = "session_token";

export type Session = Pick<
  Utente,
  "id" | "username" | "nome" | "cognome" | "isAdmin" | "abilitato"
>;

export async function getSession(): Promise<Session | null> {
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

  return {
    id: user.id,
    username: user.username,
    nome: user.nome,
    cognome: user.cognome,
    isAdmin: user.isAdmin,
    abilitato: user.abilitato,
  };
}

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

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.isAdmin) {
    redirect("/dashboard");
  }
  return session;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: getSessionMaxAgeSeconds(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
