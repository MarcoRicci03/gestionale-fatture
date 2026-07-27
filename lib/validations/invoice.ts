import { z } from "zod";
import { parseDateInput } from "@/lib/utils/date";
import { MESI } from "@/lib/constants/mesi";
import { BOLLO_CODICE_REGEX } from "@/lib/constants/bollo";
import { roundCurrency } from "@/lib/utils/currency";

// Intero, oppure con separatore decimale punto e al massimo 2 cifre dopo la
// virgola (es. "50", "50.4", "50.40"). Applicato dopo aver normalizzato un
// eventuale separatore decimale italiano (virgola) in punto.
const PREZZO_REGEX = /^\d+(\.\d{1,2})?$/;

// Limite inferiore fisso (nessuna fattura reale precede il 2000 in questo
// studio) e superiore agganciato all'anno corrente + 1 (per non bloccare
// fatture di inizio anno emesse in anticipo a dicembre). `data` è sintatticamente
// valida per qualunque anno a 4 cifre; senza questo vincolo un anno come 1850
// o 4000 passava e sporcava numerazione, aggregati e filtro anni della UI.
const ANNO_FATTURA_MIN = 2000;

export const invoiceSchema = z
  .object({
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
      .union([z.literal(""), z.enum(["CONTANTI", "CARTA", "BONIFICO"])])
      .refine((val): val is "CONTANTI" | "CARTA" | "BONIFICO" => val !== "", {
        message: "Seleziona una modalità di pagamento",
      }),
    sedute: z
      .union([z.literal(""), z.coerce.number().int().nonnegative()])
      .transform((val) => (val === "" ? undefined : val))
      .optional(),
    commento: z.string().max(2000).optional(),
    n_fattura: z.coerce.number().int().positive("Numero fattura non valido"),
    mesi: z
      .array(
        z.object({
          mese: z.enum(MESI),
          prezzo: z
            .union([z.literal(""), z.string(), z.coerce.number().nonnegative()])
            .transform((val, ctx) => {
              if (val === "") return 0;
              // Un input non numerico (es. "50,00", virgola decimale
              // italiana, o testo arbitrario) veniva prima convertito in NaN
              // e poi silenziosamente degradato a 0, salvando un importo
              // sbagliato senza alcun errore. Qui si normalizza la virgola in
              // punto e si fa fallire la validazione su qualunque input che,
              // dopo la normalizzazione, non sia un numero non negativo con
              // al massimo 2 decimali — invece di inghiottirlo come 0.
              const normalized =
                typeof val === "number" ? String(val) : val.trim().replace(",", ".");
              if (!PREZZO_REGEX.test(normalized)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message:
                    "Importo non valido: usa un numero non negativo con al massimo 2 decimali (es. 50 o 50,00)",
                });
                return z.NEVER;
              }
              return Number(normalized);
            }),
        })
      )
      .min(1, "Seleziona almeno un mese")
      .max(12, "Non è possibile inserire più di 12 mesi")
      .refine(
        (mesi) => new Set(mesi.map((m) => m.mese)).size === mesi.length,
        "Non è possibile selezionare lo stesso mese più di una volta"
      )
      .refine(
        (mesi) => roundCurrency(mesi.reduce((somma, m) => somma + m.prezzo, 0)) > 0,
        "L'importo totale deve essere maggiore di 0"
      ),
    citta: z.string().min(1, "La città è obbligatoria").max(100),
    cap: z.string().min(1, "Il CAP è obbligatorio").max(10),
    bolloCodice: z
      .union([
        z.literal(""),
        z
          .string()
          .regex(BOLLO_CODICE_REGEX, "Il codice deve contenere esattamente 14 cifre numeriche"),
      ])
      .transform((val) => (val === "" ? undefined : val))
      .optional(),
  })
  .refine(
    (val) => {
      const anno = val.data.getFullYear();
      return anno >= ANNO_FATTURA_MIN && anno <= new Date().getFullYear() + 1;
    },
    {
      message: `L'anno della fattura deve essere compreso tra ${ANNO_FATTURA_MIN} e l'anno prossimo`,
      path: ["data"],
    }
  );

export type InvoiceFormInput = z.input<typeof invoiceSchema>;
export type InvoiceFormData = z.output<typeof invoiceSchema>;
