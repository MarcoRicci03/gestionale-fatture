"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, createSessionCookie } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rate-limiter";
import { getClientIp } from "@/lib/auth/client-ip";
import { changePasswordSchema } from "@/lib/validations/user";
import { profileUpdateSchema } from "@/lib/validations/profile";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export type AccountActionState = { success: true } | { error: string };

// Senza questo limite, chi ottiene una sessione (es. un cookie rubato) può
// tentare in loop la password attuale per confermarla/riusarla altrove,
// senza alcun lockout (a differenza del login, protetto da
// lib/auth/rate-limit.ts). Chiave per userId, non per (userId, ip): a
// differenza del login, qui l'IP non serve a distinguere un attaccante da un
// utente legittimo, dato che entrambi userebbero la stessa sessione già
// autenticata.
const changePasswordLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 ora
});

export async function changePassword(
  data: unknown
): Promise<AccountActionState> {
  const session = await requireSession();

  const rateLimit = changePasswordLimiter.consume(String(session.id));
  if (!rateLimit.allowed) {
    const retryAfterMinutes = Math.ceil((rateLimit.retryAfterSeconds ?? 0) / 60);
    return {
      error: `Troppi tentativi di cambio password. Riprova tra ${retryAfterMinutes} minuti.`,
    };
  }

  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.utente.findUnique({
    where: { id: session.id },
  });
  if (!user) {
    return { error: "Utente non trovato" };
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return { error: "Password attuale errata" };
  }

  let updatedTokenVersion: number;
  try {
    const updated = await prisma.utente.update({
      where: { id: session.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        // Revoca ogni sessione firmata prima di questo cambio password (es.
        // un cookie rubato): vedi il commento su Utente.tokenVersion in
        // schema.prisma.
        tokenVersion: { increment: 1 },
      },
    });
    updatedTokenVersion = updated.tokenVersion;
  } catch (error) {
    console.error("changePassword error", error);
    return { error: "Errore durante il cambio password" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.ACCOUNT_PASSWORD_CHANGE,
    userId: session.id,
    entita: "Utente",
    entitaId: session.id,
    ip: await getClientIp(),
  });

  // Riallinea subito il cookie della sessione corrente al nuovo
  // tokenVersion: solo così l'utente che ha appena cambiato la propria
  // password resta loggato, mentre ogni altro token più vecchio viene
  // respinto da getSession al controllo successivo.
  await createSessionCookie(session.id, updatedTokenVersion);

  return { success: true };
}

export async function updateProfile(
  data: unknown
): Promise<AccountActionState> {
  const session = await requireSession();

  const parsed = profileUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  const {
    nome,
    cognome,
    pIva,
    cf,
    via,
    citta,
    cap,
    provincia,
    titolo,
    specializzazione,
  } = parsed.data;

  try {
    await prisma.utente.update({
      where: { id: session.id },
      data: {
        nome: nome?.trim() || null,
        cognome: cognome?.trim() || null,
        pIva: pIva ?? null,
        cf: cf ?? null,
        via: via?.trim() || null,
        citta: citta?.trim() || null,
        cap: cap?.trim() || null,
        provincia: provincia ?? null,
        titolo: titolo?.trim() || null,
        specializzazione: specializzazione?.trim() || null,
      },
    });
  } catch (error) {
    console.error("updateProfile error", error);
    return { error: "Errore durante l'aggiornamento del profilo" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.ACCOUNT_PROFILE_UPDATE,
    userId: session.id,
    entita: "Utente",
    entitaId: session.id,
    ip: await getClientIp(),
  });

  // I dati del profilo (mittente) sono renderizzati anche nella sidebar/
  // header e nell'anteprima del template PDF: senza invalidare la cache
  // resterebbero stantii nelle pagine già visitate finché non si forza un
  // reload. "/", "layout" invalida l'intero albero condiviso, non solo
  // /account.
  revalidatePath("/account");
  revalidatePath("/", "layout");

  return { success: true };
}
