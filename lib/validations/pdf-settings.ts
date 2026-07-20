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

// I blob "ricchi" (richContent/descrizioneRichContent/valoreRichContent) restano
// z.unknown() — non validati in profondità, per non accoppiare la validazione
// server-side alla struttura interna della libreria di rich-text (vedi i commenti
// sotto). Senza un tetto qualunque, però, sono JSON arbitrari salvati tal quali su
// Postgres: un client autenticato potrebbe scrivere payload enormi e ripetere
// l'operazione (SEC-11 in SECURITY_AUDIT.md). Il limite è sulla dimensione
// serializzata (soglia larga, pensata per un blocco di testo con formattazione),
// non sulla forma del contenuto.
const MAX_RICH_CONTENT_JSON_LENGTH = 50_000;

function boundedRichContent(maxLength: number) {
  return z.unknown().refine(
    (value) => {
      if (value === undefined) return true;
      try {
        return JSON.stringify(value).length <= maxLength;
      } catch {
        return false;
      }
    },
    { message: `Contenuto troppo grande (max ${maxLength} caratteri serializzati)` }
  );
}

export const meseConfigSchema = z.object({
  titolo: z.string().max(200).optional(),
  descrizioneTemplate: z.string().max(300),
  valoreTemplate: z.string().max(300),
  mostraTotale: z.boolean(),
  totaleLabel: z.string().max(100).optional(),
  // Stato ricco (editor WYSIWYG): blob opaco, non validato in profondità.
  // La fonte di verità per l'integrità resta descrizioneTemplate/valoreTemplate.
  descrizioneRichContent: boundedRichContent(MAX_RICH_CONTENT_JSON_LENGTH).optional(),
  valoreRichContent: boundedRichContent(MAX_RICH_CONTENT_JSON_LENGTH).optional(),
});

export const bloccoSchema = z.object({
  id: z.string().min(1).max(100),
  tipo: z.enum(tipoBloccoValues as [TipoBlocco, ...TipoBlocco[]]),
  x: z.number().int().min(0).max(595),
  y: z.number().int().min(0).max(842),
  width: z.number().int().min(10).max(595),
  height: z.number().int().min(10).max(842),
  fontSize: z.number().int().min(6).max(72),
  align: z.enum(textAlignValues as [TextAlign, ...TextAlign[]]),
  visible: z.boolean(),
  testo: z.string().max(10_000).optional(),
  // Stato ricco (editor WYSIWYG) di `testo`: blob opaco, non validato in
  // profondità per non accoppiare la validazione server-side alla struttura
  // interna della libreria di rich-text. La fonte di verità resta `testo`.
  richContent: boundedRichContent(MAX_RICH_CONTENT_JSON_LENGTH).optional(),
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
  // Tetto largo perché il layout può crescere con molti blocchi di testo/mesi
  // costruiti a mano nell'editor drag-and-drop: serve solo a impedire un
  // payload senza limite (SEC-11), non a vincolare l'uso normale.
  blocchi: z.array(bloccoSchema).min(1).max(500),
});

export type PdfSettingsFormData = z.output<typeof pdfSettingsSchema>;
export type BloccoFormData = z.output<typeof bloccoSchema>;
