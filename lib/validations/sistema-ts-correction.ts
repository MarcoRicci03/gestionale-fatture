import { z } from "zod";
import { CF_REGEX } from "@/lib/constants/fiscal";
import { BOLLO_CODICE_REGEX } from "@/lib/constants/bollo";
import { parseDateInput, isValidCalendarDateString } from "@/lib/utils/date";

// CR-05: i campi persistiti (dataPagamento, flagOpposizione, pagamentoTracciato,
// bolloCodice) non hanno default. Un campo omesso resta `undefined` e il service
// lo lascia invariato; `null`/"" espliciti svuotano il campo.
export const correggiFatturaTsSchema = z.object({
  invoiceId: z.number().int().positive("ID fattura non valido"),
  paganteCf: z
    .union([
      z.string().regex(CF_REGEX, "Codice fiscale non valido (16 caratteri alfanumerici)"),
      z.literal(""),
      z.null(),
    ])
    .transform((val) => (val === "" || val === null ? null : val.toUpperCase()))
    .optional(),
  aggiornaAnagrafica: z.boolean().default(true),
  propagaFattureInAttesa: z.boolean().default(false),
  flagOpposizione: z.boolean().optional(),
  dataPagamento: z
    .union([
      z.literal(""),
      z.null(),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida (formato atteso: AAAA-MM-GG)")
        .refine(isValidCalendarDateString, "Data non valida nel calendario reale")
        .transform((val) => parseDateInput(val)),
      z.date(),
    ])
    .transform((val) => (val === "" || val === null ? null : val))
    .optional(),
  pagamentoTracciato: z.boolean().optional(),
  bolloCodice: z
    .union([
      z.literal(""),
      z.null(),
      z
        .string()
        .regex(BOLLO_CODICE_REGEX, "Il codice marca da bollo deve contenere esattamente 14 cifre numeriche"),
    ])
    .transform((val) => (val === "" || val === null ? null : val))
    .nullable()
    .optional(),
});

export type CorreggiFatturaTsInput = z.input<typeof correggiFatturaTsSchema>;
export type CorreggiFatturaTsData = z.output<typeof correggiFatturaTsSchema>;
