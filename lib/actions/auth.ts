"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie, clearSessionCookie } from "@/lib/auth/session";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/client-ip";

export type LoginState = {
  error?: string;
};

// Cost factor 12, identico a quello usato da hashPassword() (lib/auth/password.ts):
// se questo hash avesse un cost diverso da quello reale, il tempo di verifica
// per uno username inesistente/disabilitato sarebbe misurabilmente diverso da
// quello di uno username esistente, rivelando l'esistenza dell'account tramite
// timing (vedi SEC-05 in SECURITY_AUDIT.md). Non corrisponde a nessuna password
// reale, serve solo a pareggiare i tempi di bcrypt.compare.
const DUMMY_HASH = "$2b$12$uEQH0NVA9flEIdsy4VyajO8CcJ6fP/Ygj9MSjRp0iGfhH8sylWycu";

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = formData.get("username")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!username || !password) {
    return { error: "Inserire username e password" };
  }
  if (username.length > 50 || password.length > 100) {
    return { error: "Input non valido" };
  }

  const ip = await getClientIp();

  const rateLimit = checkLoginRateLimit(username, ip);
  if (!rateLimit.allowed) {
    return {
      error: `Troppi tentativi falliti. Riprova tra ${rateLimit.retryAfterMinutes} minuti.`,
    };
  }

  const user = await prisma.utente.findUnique({
    where: { username },
  });

  if (!user) {
    recordFailedLogin(username, ip);
    await verifyPassword(password, DUMMY_HASH);
    return { error: "Credenziali non valide" };
  }

  if (!user.abilitato) {
    recordFailedLogin(username, ip);
    await verifyPassword(password, DUMMY_HASH);
    return { error: "Credenziali non valide" };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    recordFailedLogin(username, ip);
    return { error: "Credenziali non valide" };
  }

  recordSuccessfulLogin(username, ip);

  await createSessionCookie(user.id, user.tokenVersion);

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
