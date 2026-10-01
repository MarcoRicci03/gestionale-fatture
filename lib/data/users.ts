import "server-only";
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
