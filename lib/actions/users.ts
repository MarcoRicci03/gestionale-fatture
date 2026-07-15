"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import {
  userCreateSchema,
  userUpdateSchema,
  resetPasswordSchema,
} from "@/lib/validations/user";

export type UserActionState = { success: true } | { error: string };

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
  } catch {
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
  } catch {
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

  const parsed = resetPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  try {
    await prisma.utente.update({
      where: { id },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    });
  } catch {
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
  } catch {
    return { error: "Errore durante l'aggiornamento dello stato" };
  }

  revalidatePath("/users");
  return { success: true };
}
