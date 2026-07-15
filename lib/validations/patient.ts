import { z } from "zod";

export const patientSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  id_Pagante: z
    .union([
      z.literal(""),
      z.coerce.number().int().positive("Seleziona un pagante valido"),
      z.null(),
    ])
    .transform((val) => (val === "" || val === null ? null : val))
    .optional(),
});

export type PatientFormInput = z.input<typeof patientSchema>;
export type PatientFormData = z.output<typeof patientSchema>;
