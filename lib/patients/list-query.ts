import type { Prisma } from "@prisma/client";

// Ogni token della ricerca deve comparire nel cognome o nel nome del
// paziente (in qualunque ordine tra i due campi), stesso pattern di
// personaWhere in lib/invoices/list-query.ts.
function nameSearchWhere(search: string): Prisma.PazienteWhereInput {
  const tokens = search.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};
  return {
    AND: tokens.map((token) => ({
      OR: [
        { cognome: { contains: token, mode: "insensitive" as const } },
        { nome: { contains: token, mode: "insensitive" as const } },
      ],
    })),
  };
}

export function buildPatientWhere(
  userId: number,
  { search, archiviato }: { search: string; archiviato: boolean }
): Prisma.PazienteWhereInput {
  const conditions: Prisma.PazienteWhereInput[] = [
    { id_Utente: userId },
    { archiviato },
  ];

  if (search.trim()) {
    conditions.push(nameSearchWhere(search));
  }

  return { AND: conditions };
}
