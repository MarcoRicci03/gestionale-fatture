import { z } from "zod";

export const sistemaTsSettingsSchema = z.object({
  username: z
    .string()
    .min(1, "L'utenza o Codice Fiscale TS è obbligatorio")
    .max(50),
  password: z
    .string()
    .max(100)
    .optional(),
  pincode: z
    .string()
    .max(50)
    .optional(),
  codiceRegione: z
    .string()
    .nullish()
    .transform((val) => {
      const trimmed = val?.trim();
      return !trimmed ? "000" : trimmed.toUpperCase();
    })
    .refine(
      (val) => /^[A-Z0-9]{3}$/.test(val),
      "Il codice regione deve essere composto da 3 caratteri alfanumerici (es. '000' o '030')"
    ),
  codiceAsl: z
    .string()
    .nullish()
    .transform((val) => {
      const trimmed = val?.trim();
      return !trimmed ? "000" : trimmed.toUpperCase();
    })
    .refine(
      (val) => /^[A-Z0-9]{3}$/.test(val),
      "Il codice ASL deve essere composto da 3 caratteri alfanumerici (es. '000' o '101')"
    ),
  codiceStruttura: z
    .string()
    .nullish()
    .transform((val) => {
      const trimmed = val?.trim();
      return !trimmed ? null : trimmed.toUpperCase();
    })
    .refine(
      (val) => val === null || /^[A-Z0-9]{5,6}$/.test(val),
      "Il codice struttura (SSA) deve contenere 5 o 6 caratteri alfanumerici (es. '12345')"
    ),
  naturaIvaDefault: z
    .enum(["N2.2", "N4"], {
      message: "Seleziona una natura IVA predefinita valida (N2.2 per forfettario o N4 per esente art. 10)",
    })
    .default("N2.2"),
});

export type SistemaTsSettingsInput = z.input<typeof sistemaTsSettingsSchema>;
export type SistemaTsSettingsData = z.output<typeof sistemaTsSettingsSchema>;

// P010: tetto sul numero di fatture per lotto, come MAX_EXPORT_INVOICES per
// l'export: protegge la clausola IN() e la generazione dell'XML da un
// payload arbitrario inviato direttamente all'endpoint RPC.
export const MAX_FATTURE_PER_LOTTO = 1000;

export const invioLottoSchema = z.object({
  invoiceIds: z
    .array(z.number().int().positive().max(2_147_483_647))
    .min(1, "Nessuna fattura selezionata per l'invio.")
    .max(MAX_FATTURE_PER_LOTTO, `Non è possibile trasmettere più di ${MAX_FATTURE_PER_LOTTO} fatture in un lotto`),
});

export type InvioLottoInput = z.input<typeof invioLottoSchema>;
