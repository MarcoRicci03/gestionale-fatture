import { z } from "zod";
import { parseDateInput } from "@/lib/utils/date";
import { MESI } from "@/lib/constants/mesi";

export const invoiceSchema = z.object({
  id_Pagante: z.coerce.number().int().positive("Seleziona un pagante"),
  id_Paziente: z.coerce.number().int().positive("Seleziona un paziente"),
  data: z.union([
    z.date(),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
      .transform((val) => parseDateInput(val)),
  ]),
  mod_pag: z
    .string()
    .refine(
      (val) => ["CONTANTI", "CARTA", "BONIFICO"].includes(val),
      "Seleziona una modalità di pagamento"
    ),
  sedute: z
    .union([z.literal(""), z.coerce.number().int().nonnegative()])
    .transform((val) => (val === "" ? undefined : val))
    .optional(),
  commento: z.string().optional(),
  n_fattura: z.coerce.number().int().positive("Numero fattura non valido"),
  mesi: z
    .array(
      z.object({
        mese: z.enum(MESI),
        prezzo: z
          .union([z.literal(""), z.string(), z.coerce.number().nonnegative()])
          .transform((val) => {
            if (val === "") return 0;
            const n = typeof val === "number" ? val : Number(val);
            return Number.isFinite(n) ? n : 0;
          }),
      })
    )
    .min(1, "Seleziona almeno un mese")
    .refine(
      (mesi) => mesi.reduce((somma, m) => somma + m.prezzo, 0) > 0,
      "L'importo totale deve essere maggiore di 0"
    ),
  citta: z.string().min(1, "La città è obbligatoria"),
  cap: z.string().min(1, "Il CAP è obbligatorio"),
});

export type InvoiceFormInput = z.input<typeof invoiceSchema>;
export type InvoiceFormData = z.output<typeof invoiceSchema>;
