import { z } from "zod";
import type { TipoBlocco, TextAlign } from "@/lib/pdf/types";

const tipoBloccoValues: TipoBlocco[] = [
  "mittente",
  "intestatario",
  "paziente",
  "pagamento",
  "testo",
  "mesi",
];

const textAlignValues: TextAlign[] = ["left", "center", "right"];

export const meseConfigSchema = z.object({
  titolo: z.string().max(200).optional(),
  descrizioneTemplate: z.string().max(300),
  valoreTemplate: z.string().max(300),
  mostraTotale: z.boolean(),
  totaleLabel: z.string().max(100).optional(),
  // Stato ricco (editor WYSIWYG): blob opaco, non validato in profondità.
  // La fonte di verità per l'integrità resta descrizioneTemplate/valoreTemplate.
  descrizioneRichContent: z.unknown().optional(),
  valoreRichContent: z.unknown().optional(),
});

export const bloccoSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(tipoBloccoValues as [TipoBlocco, ...TipoBlocco[]]),
  x: z.number().int().min(0).max(595),
  y: z.number().int().min(0).max(842),
  width: z.number().int().min(10).max(595),
  height: z.number().int().min(10).max(842),
  fontSize: z.number().int().min(6).max(72),
  align: z.enum(textAlignValues as [TextAlign, ...TextAlign[]]),
  visible: z.boolean(),
  testo: z.string().optional(),
  // Stato ricco (editor WYSIWYG) di `testo`: blob opaco, non validato in
  // profondità per non accoppiare la validazione server-side alla struttura
  // interna della libreria di rich-text. La fonte di verità resta `testo`.
  richContent: z.unknown().optional(),
  meseConfig: meseConfigSchema.optional(),
  paddingTop: z.number().int().min(0).max(100).optional(),
  paddingRight: z.number().int().min(0).max(100).optional(),
  paddingBottom: z.number().int().min(0).max(100).optional(),
  paddingLeft: z.number().int().min(0).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Colore non valido")
    .optional(),
  fontWeight: z.enum(["normal", "bold"] as const).optional(),
});

export const pdfSettingsSchema = z.object({
  pageWidth: z.number().int().min(200).max(1200).default(595),
  pageHeight: z.number().int().min(200).max(1700).default(842),
  marginTop: z.number().int().min(0).max(400).default(40),
  marginRight: z.number().int().min(0).max(400).default(40),
  marginBottom: z.number().int().min(0).max(400).default(40),
  marginLeft: z.number().int().min(0).max(400).default(40),
  fontFamily: z.string().min(1).max(100).default("Helvetica"),
  fontSizeBase: z.number().int().min(6).max(72).default(11),
  blocchi: z.array(bloccoSchema).min(1),
});

export type PdfSettingsFormData = z.output<typeof pdfSettingsSchema>;
export type BloccoFormData = z.output<typeof bloccoSchema>;
