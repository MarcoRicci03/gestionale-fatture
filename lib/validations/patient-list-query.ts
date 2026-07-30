import { z } from "zod";
import { pageSchema } from "@/lib/utils/pagination";

const searchSchema = z.string().max(200);

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// `page` pagina la lista attivi, `archivedPage` la lista archiviati: sono
// indipendenti perché il cambio tab attivi/archiviati resta client-only
// (vedi PatientsManager), ma condividono lo stesso testo di ricerca `q`.
export function parsePatientListQuery(raw: RawSearchParams): {
  search: string;
  page: number;
  archivedPage: number;
} {
  const parsedSearch = searchSchema.safeParse(firstValue(raw.q));
  const search = parsedSearch.success ? parsedSearch.data : "";

  const parsedPage = pageSchema.safeParse(firstValue(raw.page));
  const page = parsedPage.success ? parsedPage.data : 1;

  const parsedArchivedPage = pageSchema.safeParse(firstValue(raw.archivedPage));
  const archivedPage = parsedArchivedPage.success ? parsedArchivedPage.data : 1;

  return { search, page, archivedPage };
}
