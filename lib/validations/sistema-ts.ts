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
    .max(3, "Il codice regione deve contenere al massimo 3 caratteri")
    .optional()
    .transform((val) => (val ? val.trim() : "000")),
  codiceAsl: z
    .string()
    .max(3, "Il codice ASL deve contenere al massimo 3 caratteri")
    .optional()
    .transform((val) => (val ? val.trim() : "000")),
  codiceStruttura: z
    .string()
    .max(20)
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  naturaIvaDefault: z
    .enum(["N2.2", "N4"], {
      message: "Seleziona una natura IVA predefinita valida (N2.2 per forfettario o N4 per esente art. 10)",
    })
    .default("N2.2"),
});

export type SistemaTsSettingsInput = z.input<typeof sistemaTsSettingsSchema>;
export type SistemaTsSettingsData = z.output<typeof sistemaTsSettingsSchema>;

export const invioLottoSchema = z.object({
  invoiceIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "Seleziona almeno una fattura da trasmettere"),
});

export type InvioLottoInput = z.input<typeof invioLottoSchema>;
