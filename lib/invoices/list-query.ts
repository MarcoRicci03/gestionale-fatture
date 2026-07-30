import type { Prisma, ModalitaPagamento } from "@prisma/client";
import { parseDateInput } from "@/lib/utils/date";
import type { InvoiceFilters } from "@/components/invoices/invoice-filters";

export { lastValidPage } from "@/lib/utils/pagination";

const VALID_MOD_PAG: readonly string[] = ["CONTANTI", "CARTA", "BONIFICO"];

function isModalitaPagamento(value: string): value is ModalitaPagamento {
  return VALID_MOD_PAG.includes(value);
}

// Ogni token del filtro persona deve comparire nel cognome o nel nome del
// pagante o del paziente (in qualunque ordine tra i due campi). Approccio
// più permissivo del confronto client-side che sostituisce (che cercava
// `persona` come sottostringa contigua di "cognome nome" concatenato): qui
// serve una query Prisma senza SQL raw, e "ogni parola compare da qualche
// parte nel nome" è un pattern di ricerca comunque più utile per l'utente.
function personaWhere(persona: string): Prisma.PagamentoWhereInput {
  const tokens = persona.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};
  return {
    AND: tokens.map((token) => ({
      OR: [
        {
          pagante: {
            is: {
              OR: [
                { cognome: { contains: token, mode: "insensitive" as const } },
                { nome: { contains: token, mode: "insensitive" as const } },
              ],
            },
          },
        },
        {
          paziente: {
            is: {
              OR: [
                { cognome: { contains: token, mode: "insensitive" as const } },
                { nome: { contains: token, mode: "insensitive" as const } },
              ],
            },
          },
        },
      ],
    })),
  };
}

export function buildInvoiceWhere(
  userId: number,
  filters: InvoiceFilters
): Prisma.PagamentoWhereInput {
  const conditions: Prisma.PagamentoWhereInput[] = [{ id_Utente: userId }];

  if (filters.dataDa || filters.dataA) {
    conditions.push({
      data: {
        ...(filters.dataDa ? { gte: parseDateInput(filters.dataDa) } : {}),
        ...(filters.dataA ? { lte: parseDateInput(filters.dataA) } : {}),
      },
    });
  }
  if (filters.anno) {
    conditions.push({ anno: Number(filters.anno) });
  }
  if (filters.modPag && isModalitaPagamento(filters.modPag)) {
    conditions.push({ mod_pag: filters.modPag });
  }
  if (filters.persona.trim()) {
    conditions.push(personaWhere(filters.persona));
  }

  return { AND: conditions };
}
