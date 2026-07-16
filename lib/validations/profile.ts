import { z } from "zod";

export const profileUpdateSchema = z.object({
  nome: z.string().optional(),
  cognome: z.string().optional(),
  pIva: z
    .union([
      z.string().regex(/^\d{11}$/, "P.IVA non valida (11 cifre)"),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v === "" || v === null ? null : v))
    .optional(),
  cf: z
    .union([
      z.string().regex(/^[A-Za-z0-9]{16}$/, "Codice fiscale non valido (16 caratteri)"),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v === "" || v === null ? null : v))
    .optional(),
  via: z.string().optional(),
  citta: z.string().optional(),
  cap: z.string().optional(),
  provincia: z
    .union([
      z.string().regex(/^[A-Za-z]{2}$/, "Provincia non valida (sigla di 2 lettere)"),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v === "" || v === null ? null : v.toUpperCase()))
    .optional(),
  titolo: z.string().optional(),
  specializzazione: z.string().optional(),
});

export type ProfileUpdateFormData = z.output<typeof profileUpdateSchema>;
