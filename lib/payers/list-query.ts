import type { Prisma } from "@prisma/client";

// Ogni token della ricerca deve comparire in almeno uno tra cognome, nome,
// CF o P.IVA del pagante, stesso pattern di personaWhere in
// lib/invoices/list-query.ts. CF/P.IVA inclusi (a differenza della ricerca
// pazienti) perché sono i due identificativi con cui un pagante viene più
// spesso cercato.
function nameSearchWhere(search: string): Prisma.PaganteWhereInput {
  const tokens = search.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};
  return {
    AND: tokens.map((token) => ({
      OR: [
        { cognome: { contains: token, mode: "insensitive" as const } },
        { nome: { contains: token, mode: "insensitive" as const } },
        { cf: { contains: token, mode: "insensitive" as const } },
        { piva: { contains: token, mode: "insensitive" as const } },
      ],
    })),
  };
}

export function buildPayerWhere(
  userId: number,
  { search, archiviato }: { search: string; archiviato: boolean }
): Prisma.PaganteWhereInput {
  const conditions: Prisma.PaganteWhereInput[] = [
    { id_Utente: userId },
    { archiviato },
  ];

  if (search.trim()) {
    conditions.push(nameSearchWhere(search));
  }

  return { AND: conditions };
}
