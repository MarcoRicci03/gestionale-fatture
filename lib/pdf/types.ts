import type { Pagamento, Pagante, Paziente, Utente, FatturaMese } from "@prisma/client";

export type TipoBlocco =
  | "mittente"
  | "intestatario"
  | "paziente"
  | "pagamento"
  | "testo"
  | "mesi";

export type TextAlign = "left" | "center" | "right";

/** Solo per tipo 'mesi': una riga per mese, con descrizione a sinistra e valore allineato a destra */
export type MeseConfig = {
  titolo?: string;
  descrizioneTemplate: string;
  valoreTemplate: string;
  mostraTotale: boolean;
  totaleLabel?: string;
};

export type Blocco = {
  id: string;
  tipo: TipoBlocco;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  align: TextAlign;
  visible: boolean;
  /** Solo per tipo 'testo': contenuto con placeholder {{...}} */
  testo?: string;
  /** Solo per tipo 'mesi': configurazione riga descrizione/valore per mese */
  meseConfig?: MeseConfig;
  /** Padding interno opzionale in pt */
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  /** Colore testo in formato hex (es. #000000) o nome CSS */
  color?: string;
  /** Spessore font: 'normal' | 'bold' */
  fontWeight?: "normal" | "bold";
  /** z-index implicito dato dalla posizione nell'array */
};

export type PdfLayout = {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  fontFamily: string;
  fontSizeBase: number;
  blocchi: Blocco[];
};

export type ImpostazioniPdf = PdfLayout & {
  id: number;
  id_Utente: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PdfSettingsInput = PdfLayout;

export type InvoiceWithRelations = Pagamento & {
  pagante: Pagante;
  paziente: Paziente;
  mesi: FatturaMese[];
  utente: Utente;
};

export function isTextAlign(value: unknown): value is TextAlign {
  return value === "left" || value === "center" || value === "right";
}

export function isTipoBlocco(value: unknown): value is TipoBlocco {
  return (
    value === "mittente" ||
    value === "intestatario" ||
    value === "paziente" ||
    value === "pagamento" ||
    value === "testo" ||
    value === "mesi"
  );
}

export function isMeseConfig(value: unknown): value is MeseConfig {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.titolo === undefined || typeof v.titolo === "string") &&
    typeof v.descrizioneTemplate === "string" &&
    typeof v.valoreTemplate === "string" &&
    typeof v.mostraTotale === "boolean" &&
    (v.totaleLabel === undefined || typeof v.totaleLabel === "string")
  );
}

export function isBlocco(value: unknown): value is Blocco {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.id === "string" &&
    isTipoBlocco(v.tipo) &&
    typeof v.x === "number" &&
    typeof v.y === "number" &&
    typeof v.width === "number" &&
    typeof v.height === "number" &&
    typeof v.fontSize === "number" &&
    isTextAlign(v.align) &&
    typeof v.visible === "boolean" &&
    (v.testo === undefined || typeof v.testo === "string") &&
    (v.meseConfig === undefined || isMeseConfig(v.meseConfig)) &&
    (v.color === undefined || typeof v.color === "string") &&
    (v.fontWeight === undefined ||
      v.fontWeight === "normal" ||
      v.fontWeight === "bold")
  );
}

export function isPdfLayout(value: unknown): value is PdfLayout {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.pageWidth === "number" &&
    typeof v.pageHeight === "number" &&
    typeof v.marginTop === "number" &&
    typeof v.marginRight === "number" &&
    typeof v.marginBottom === "number" &&
    typeof v.marginLeft === "number" &&
    typeof v.fontFamily === "string" &&
    typeof v.fontSizeBase === "number" &&
    Array.isArray(v.blocchi) &&
    v.blocchi.every(isBlocco)
  );
}

export function isPrismaImpostazioniPdf(
  value: unknown
): value is ImpostazioniPdf {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    typeof v.id_Utente === "number" &&
    typeof v.createdAt === "object" &&
    v.createdAt instanceof Date &&
    typeof v.updatedAt === "object" &&
    v.updatedAt instanceof Date &&
    isPdfLayout(value)
  );
}
