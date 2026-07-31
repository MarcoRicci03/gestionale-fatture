import { z } from "zod";
import { pageSchema } from "@/lib/utils/pagination";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit/actions";
import {
  EMPTY_AUDIT_LOG_FILTERS,
  type AuditLogFilters,
} from "@/lib/audit/list-query";

const AZIONE_VALUES = Object.values(AUDIT_ACTIONS) as [AuditAction, ...AuditAction[]];

const auditLogFiltersSchema = z.object({
  dataDa: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  dataA: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  utente: z.string().max(100),
  azione: z.union([z.literal(""), z.enum(AZIONE_VALUES)]),
  ricerca: z.string().max(200),
});

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// A differenza di parseInvoiceListQuery, nessun flag "f"/default
// "intelligente": qui il default naturale è "nessun filtro", non serve
// distinguere "mai impostato" da "svuotato a mano" (stesso pattern piatto di
// parsePayerListQuery).
export function parseAuditLogListQuery(raw: RawSearchParams): {
  filters: AuditLogFilters;
  page: number;
} {
  const parsed = auditLogFiltersSchema.safeParse({
    dataDa: firstValue(raw.dataDa),
    dataA: firstValue(raw.dataA),
    utente: firstValue(raw.utente),
    azione: firstValue(raw.azione),
    ricerca: firstValue(raw.ricerca),
  });
  const filters = parsed.success ? parsed.data : EMPTY_AUDIT_LOG_FILTERS;

  const parsedPage = pageSchema.safeParse(firstValue(raw.page));
  const page = parsedPage.success ? parsedPage.data : 1;

  return { filters, page };
}
