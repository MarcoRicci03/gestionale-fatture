"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rate-limiter";
import { isUniqueViolationOnField } from "@/lib/prisma-errors";
import {
  userCreateSchema,
  userUpdateSchema,
  resetPasswordSchema,
} from "@/lib/validations/user";

export type UserActionState = { success: true } | { error: string };

// Senza questo limite, una sessione admin compromessa potrebbe resettare in
// loop la password di ogni utente (vedi SEC-08 in SECURITY_AUDIT.md). Soglia
// più larga di changePassword perché un admin legittimo può dover resettare
// più account in sequenza (es. dopo un incidente).
const resetPasswordLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 60 * 60 * 1000, // 1 ora
});

export async function createUser(
  data: unknown
): Promise<UserActionState> {
  await requireAdmin();

  const parsed = userCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  const { username, nome, cognome, password, isAdmin, abilitato } = parsed.data;

  const existing = await prisma.utente.findUnique({ where: { username } });
  if (existing) {
    return { error: "Username già in uso" };
  }

  try {
    await prisma.utente.create({
      data: {
        username,
        nome: nome || null,
        cognome: cognome || null,
        passwordHash: await hashPassword(password),
        isAdmin,
        abilitato,
      },
    });
  } catch (error) {
    if (isUniqueViolationOnField(error, "username")) {
      return { error: "Username già in uso" };
    }
    console.error("createUser error", error);
    return { error: "Errore durante la creazione dell'utente" };
  }

  revalidatePath("/users");
  return { success: true };
}

export async function updateUser(
  id: number,
  data: unknown
): Promise<UserActionState> {
  const session = await requireAdmin();

  if (session.id === id) {
    return { error: "Non puoi modificare il tuo account da qui" };
  }

  const parsed = userUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  const { username, nome, cognome, isAdmin, abilitato } = parsed.data;

  const existing = await prisma.utente.findUnique({ where: { username } });
  if (existing && existing.id !== id) {
    return { error: "Username già in uso" };
  }

  try {
    await prisma.utente.update({
      where: { id },
      data: {
        username,
        nome: nome || null,
        cognome: cognome || null,
        isAdmin,
        abilitato,
      },
    });
  } catch (error) {
    if (isUniqueViolationOnField(error, "username")) {
      return { error: "Username già in uso" };
    }
    console.error("updateUser error", error);
    return { error: "Errore durante l'aggiornamento dell'utente" };
  }

  revalidatePath("/users");
  return { success: true };
}

export async function resetUserPassword(
  id: number,
  data: unknown
): Promise<UserActionState> {
  const session = await requireAdmin();

  if (session.id === id) {
    return { error: "Non puoi resettare la tua password da qui" };
  }

  const rateLimit = resetPasswordLimiter.consume(String(session.id));
  if (!rateLimit.allowed) {
    const retryAfterMinutes = Math.ceil((rateLimit.retryAfterSeconds ?? 0) / 60);
    return {
      error: `Troppi reset password consecutivi. Riprova tra ${retryAfterMinutes} minuti.`,
    };
  }

  const parsed = resetPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  try {
    await prisma.utente.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        // Revoca ogni sessione dell'utente aperta con la vecchia password
        // (vedi il commento su Utente.tokenVersion in schema.prisma).
        tokenVersion: { increment: 1 },
      },
    });
  } catch (error) {
    console.error("resetUserPassword error", error);
    return { error: "Errore durante il reset della password" };
  }

  revalidatePath("/users");
  return { success: true };
}

export async function toggleUserEnabled(
  id: number,
  abilitato: boolean
): Promise<UserActionState> {
  const session = await requireAdmin();

  if (session.id === id) {
    return { error: "Non puoi disabilitare il tuo account" };
  }

  try {
    await prisma.utente.update({
      where: { id },
      data: { abilitato },
    });
  } catch (error) {
    console.error("toggleUserEnabled error", error);
    return { error: "Errore durante l'aggiornamento dello stato" };
  }

  revalidatePath("/users");
  return { success: true };
}
