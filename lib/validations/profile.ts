import { z } from "zod";
import { CF_REGEX, PIVA_REGEX } from "@/lib/constants/fiscal";

export const profileUpdateSchema = z.object({
  nome: z.string().max(100).optional(),
  cognome: z.string().max(100).optional(),
  pIva: z
    .union([
      z.string().regex(PIVA_REGEX, "P.IVA non valida (11 cifre)"),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v === "" || v === null ? null : v))
    .optional(),
  cf: z
    .union([
      z.string().regex(CF_REGEX, "Codice fiscale non valido (16 caratteri)"),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v === "" || v === null ? null : v))
    .optional(),
  via: z.string().max(200).optional(),
  citta: z.string().max(100).optional(),
  cap: z.string().max(10).optional(),
  provincia: z
    .union([
      z.string().regex(/^[A-Za-z]{2}$/, "Provincia non valida (sigla di 2 lettere)"),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v === "" || v === null ? null : v.toUpperCase()))
    .optional(),
  titolo: z.string().max(50).optional(),
  specializzazione: z.string().max(100).optional(),
});

export type ProfileUpdateFormData = z.output<typeof profileUpdateSchema>;
