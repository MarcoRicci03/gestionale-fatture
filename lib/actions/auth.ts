"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/session";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/client-ip";

export type LoginState = {
  error?: string;
};

const DUMMY_HASH = "$2b$10$wN9Q/35I9qR/V.Y.5rJ9d.fA/C7j.39/4/51r2X73456789012345";

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

  const token = await signSession(user.id);
  await setSessionCookie(token);

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
