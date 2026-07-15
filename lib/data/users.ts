import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";

export async function getUsers() {
  await requireAdmin();
  return prisma.utente.findMany({
    orderBy: [{ cognome: "asc" }, { nome: "asc" }, { username: "asc" }],
  });
}

export async function getUserById(id: number) {
  await requireAdmin();
  return prisma.utente.findUnique({ where: { id } });
}

export async function getUserByUsername(username: string) {
  await requireAdmin();
  return prisma.utente.findUnique({ where: { username } });
}
