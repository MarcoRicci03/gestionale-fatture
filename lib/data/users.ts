import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { SAFE_USER_SELECT, type SafeUtente } from "./user-select";

export async function getUsers(): Promise<SafeUtente[]> {
  await requireAdmin();
  return prisma.utente.findMany({
    select: SAFE_USER_SELECT,
    orderBy: [{ cognome: "asc" }, { nome: "asc" }, { username: "asc" }],
  });
}

export async function getUserById(id: number): Promise<SafeUtente | null> {
  await requireAdmin();
  return prisma.utente.findUnique({
    where: { id },
    select: SAFE_USER_SELECT,
  });
}

export async function getUserByUsername(
  username: string
): Promise<SafeUtente | null> {
  await requireAdmin();
  return prisma.utente.findUnique({
    where: { username },
    select: SAFE_USER_SELECT,
  });
}
