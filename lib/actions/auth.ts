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

export type LoginState = {
  error?: string;
};

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = formData.get("username")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!username || !password) {
    return { error: "Inserire username e password" };
  }

  const rateLimit = checkLoginRateLimit(username);
  if (!rateLimit.allowed) {
    return {
      error: `Troppi tentativi falliti. Riprova tra ${rateLimit.retryAfterMinutes} minuti.`,
    };
  }

  const user = await prisma.utente.findUnique({
    where: { username },
  });

  if (!user) {
    recordFailedLogin(username);
    return { error: "Credenziali non valide" };
  }

  if (!user.abilitato) {
    recordFailedLogin(username);
    return { error: "Account disabilitato" };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    recordFailedLogin(username);
    return { error: "Credenziali non valide" };
  }

  recordSuccessfulLogin(username);

  const token = await signSession(user.id);
  await setSessionCookie(token);

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
