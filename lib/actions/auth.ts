"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionCookie,
  clearSessionCookie,
  getSession,
} from "@/lib/auth/session";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/client-ip";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { redactUsernameForAudit } from "@/lib/audit/redact-username";

export type LoginState = {
  success?: boolean;
  error?: string;
};

// Cost factor 12, identico a quello usato da hashPassword() (lib/auth/password.ts):
// se questo hash avesse un cost diverso da quello reale, il tempo di verifica
// per uno username inesistente/disabilitato sarebbe misurabilmente diverso da
// quello di uno username esistente, rivelando l'esistenza dell'account tramite
// timing. Non corrisponde a nessuna password reale, serve solo a pareggiare i
// tempi di bcrypt.compare.
const DUMMY_HASH = "$2b$12$uEQH0NVA9flEIdsy4VyajO8CcJ6fP/Ygj9MSjRp0iGfhH8sylWycu";

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = formData.get("username")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!username || !password) {
    return { success: false, error: "Inserire username e password" };
  }

  // SEC-10: Risolve timing leakage e bypass del rate limiter su input fuori range:
  // 1. Risolve l'IP del client e controlla il rate limit PRIMA dei controlli di lunghezza,
  //    impedendo che input sovradimensionati bypassino il conteggio dei tentativi e il blocco IP/utente.
  //    Tronchiamo la chiave di tracking a max 50 caratteri per evitare allocazioni arbitrarie di memoria.
  const ip = await getClientIp();
  const rateLimitKey = username.slice(0, 50);

  const rateLimit = checkLoginRateLimit(rateLimitKey, ip);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Troppi tentativi falliti. Riprova tra ${rateLimit.retryAfterMinutes} minuti.`,
    };
  }

  // 2. Se l'input supera i limiti massimi ammessi (username > 50 caratteri, o password > 72 byte/caratteri),
  //    registriamo il fallimento nel rate limiter, eseguiamo la comparazione con DUMMY_HASH per pareggiare
  //    il tempo di risposta a quello di una normale verifica bcrypt (~100ms) evitando timing leak oracles,
  //    tracciamo l'audit log e restituiamo il messaggio uniforme "Credenziali non valide".
  if (
    username.length > 50 ||
    password.length > 72 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    recordFailedLogin(rateLimitKey, ip);
    await verifyPassword(password.slice(0, 72), DUMMY_HASH);
    await logAudit({
      azione: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      userId: null,
      ip,
      meta: {
        motivo: "input_fuori_limite",
        usernameTentato: redactUsernameForAudit(rateLimitKey),
      },
    });
    return { success: false, error: "Credenziali non valide" };
  }

  const user = await prisma.utente.findUnique({
    where: { username },
  });

  if (!user) {
    recordFailedLogin(rateLimitKey, ip);
    await verifyPassword(password, DUMMY_HASH);
    await logAudit({
      azione: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      userId: null,
      ip,
      // Troncato: l'errore di digitazione più comune al login è scrivere la
      // password nel campo username, e questo valore finirebbe altrimenti in
      // chiaro nell'audit log visibile a ogni admin (SEC-11).
      meta: {
        motivo: "utente_inesistente",
        usernameTentato: redactUsernameForAudit(rateLimitKey),
      },
    });
    return { success: false, error: "Credenziali non valide" };
  }

  if (!user.abilitato) {
    recordFailedLogin(rateLimitKey, ip);
    await verifyPassword(password, DUMMY_HASH);
    await logAudit({
      azione: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      userId: user.id,
      entita: "Utente",
      entitaId: user.id,
      ip,
      meta: { motivo: "utente_disabilitato" },
    });
    return { success: false, error: "Credenziali non valide" };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    recordFailedLogin(rateLimitKey, ip);
    await logAudit({
      azione: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      userId: user.id,
      entita: "Utente",
      entitaId: user.id,
      ip,
      meta: { motivo: "password_errata" },
    });
    return { success: false, error: "Credenziali non valide" };
  }

  recordSuccessfulLogin(username, ip);

  await logAudit({
    azione: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    userId: user.id,
    entita: "Utente",
    entitaId: user.id,
    ip,
  });

  await createSessionCookie(user.id, user.tokenVersion);

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const session = await getSession();

  await clearSessionCookie();

  if (session) {
    try {
      // SEC-08: incrementa tokenVersion in DB al logout per revocare istantaneamente
      // la validità del token JWT anche lato server, impedendo il riuso di token
      // esfiltrati o rimasti in cache su dispositivi condivisi.
      await prisma.utente.update({
        where: { id: session.id },
        data: { tokenVersion: { increment: 1 } },
      });
    } catch (error) {
      console.error("logout tokenVersion increment error", error);
    }

    await logAudit({
      azione: AUDIT_ACTIONS.AUTH_LOGOUT,
      userId: session.id,
      entita: "Utente",
      entitaId: session.id,
      ip: await getClientIp(),
    });
  }

  redirect("/login");
}
