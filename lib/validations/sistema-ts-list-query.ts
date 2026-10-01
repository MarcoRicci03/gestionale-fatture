import { z } from "zod";
import { StatoTs } from "@prisma/client";
import { isValidCalendarDateString } from "@/lib/utils/date";

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const dateSchema = z.string().refine(isValidCalendarDateString);
const statoSchema = z.union([z.enum(StatoTs), z.literal("ALL")]);

export type SistemaTsStatoFiltro = z.infer<typeof statoSchema>;

// P011: i searchParams di /sistema-ts arrivano dall'URL. Una data non valida
// faceva lanciare parseDateInput e uno stato sconosciuto arrivava a Prisma:
// in entrambi i casi la pagina andava in errore. Qui un valore non valido
// viene ignorato, come per gli altri parseXxxListQuery.
export function parseSistemaTsListQuery(raw: RawSearchParams): {
  dateFrom?: string;
  dateTo?: string;
  stato?: SistemaTsStatoFiltro;
} {
  const dateFrom = dateSchema.safeParse(firstValue(raw.dateFrom));
  const dateTo = dateSchema.safeParse(firstValue(raw.dateTo));
  const stato = statoSchema.safeParse(firstValue(raw.stato));
  return {
    dateFrom: dateFrom.success ? dateFrom.data : undefined,
    dateTo: dateTo.success ? dateTo.data : undefined,
    stato: stato.success ? stato.data : undefined,
  };
}
