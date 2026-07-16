"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePasswordSchema } from "@/lib/validations/user";
import { profileUpdateSchema } from "@/lib/validations/profile";

export type AccountActionState = { success: true } | { error: string };

export async function changePassword(
  data: unknown
): Promise<AccountActionState> {
  const session = await requireSession();

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

  try {
    await prisma.utente.update({
      where: { id: session.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  } catch {
    return { error: "Errore durante il cambio password" };
  }

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
        provincia: provincia ?? null,
        titolo: titolo?.trim() || null,
        specializzazione: specializzazione?.trim() || null,
      },
    });
  } catch {
    return { error: "Errore durante l'aggiornamento del profilo" };
  }

  return { success: true };
}
