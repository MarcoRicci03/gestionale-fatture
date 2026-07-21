import { z } from "zod";
import { CF_REGEX, PIVA_REGEX } from "@/lib/constants/fiscal";

export const payerSchema = z
  .object({
    nome: z.string().min(1, "Il nome è obbligatorio").max(100),
    cognome: z.string().min(1, "Il cognome è obbligatorio").max(100),
    via: z.string().min(1, "La via è obbligatoria").max(200),
    citta: z.string().min(1, "La città è obbligatoria").max(100),
    cap: z.string().min(1, "Il CAP è obbligatorio").max(10),
    cf: z
      .union([
        z.string().regex(CF_REGEX, "Codice fiscale non valido (16 caratteri alfanumerici)"),
        z.literal(""),
        z.null(),
      ])
      .transform((val) => (val === "" || val === null ? null : val.toUpperCase()))
      .optional(),
    piva: z
      .union([
        z.string().regex(PIVA_REGEX, "P.IVA non valida (11 cifre numeriche)"),
        z.literal(""),
        z.null(),
      ])
      .transform((val) => (val === "" || val === null ? null : val))
      .optional(),
  })
  .refine(
    (data) => {
      const hasCf = data.cf != null;
      const hasPiva = data.piva != null;
      return (hasCf || hasPiva) && !(hasCf && hasPiva);
    },
    {
      message: "Inserire solo il Codice Fiscale o solo la Partita IVA",
    }
  );

export type PayerFormInput = z.input<typeof payerSchema>;
export type PayerFormData = z.output<typeof payerSchema>;
