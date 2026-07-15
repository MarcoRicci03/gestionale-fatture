import { z } from "zod";

export const payerSchema = z
  .object({
    nome: z.string().min(1, "Il nome è obbligatorio"),
    cognome: z.string().min(1, "Il cognome è obbligatorio"),
    via: z.string().min(1, "La via è obbligatoria"),
    citta: z.string().min(1, "La città è obbligatoria"),
    cap: z.string().min(1, "Il CAP è obbligatorio"),
    cf: z
      .union([z.string().min(1).max(16), z.literal(""), z.null()])
      .transform((val) => (val === "" || val === null ? null : val))
      .optional(),
    piva: z
      .union([z.string().min(1).max(11), z.literal(""), z.null()])
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
