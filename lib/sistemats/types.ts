export type TipoSpesa = "SP";

export type FlagOperazione = "I" | "C";

export interface VoceSpesaPayload {
  tipoSpesa: TipoSpesa;
  importo: number;
  naturaIva?: string; // Es. "N2.2", "N4", "N1"
}

export interface IdSpesaPayload {
  pIva: string;
  dataEmissione: Date;
  numDocumento: string; // Progressivo fattura
  dispositivo?: number; // Default 1
}

export interface DocumentoSpesaPayload {
  idSpesa: IdSpesaPayload;
  dataPagamento: Date;
  flagOperazione?: FlagOperazione; // "I" per inserimento, "C" per cancellazione
  cfCittadino: string; // CF cittadino da cifrare
  pagamentoTracciato: "SI" | "NO";
  tipoDocumento?: "F"; // Default "F"
  flagOpposizione?: 0 | 1; // 0 = No opposizione, 1 = Opposizione
  vociSpesa: VoceSpesaPayload[];
}

export interface ProprietarioPayload {
  codiceRegione?: string | null;
  codiceAsl?: string | null;
  codiceStruttura?: string | null;
  cfProprietario: string;
}

export interface SpesaSanitariaPayload {
  proprietario: ProprietarioPayload;
  documenti: DocumentoSpesaPayload[];
}

export interface SistemaTsConfig {
  username: string;
  passwordDecrypted: string;
  pincodeDecrypted: string;
  codiceRegione?: string | null;
  codiceAsl?: string | null;
  codiceStruttura?: string | null;
  cfProprietario: string;
  certPath?: string;
  endpointInvio?: string;
  endpointEsito?: string;
  endpointRicevuta?: string;
  endpointErrori?: string;
  tlsVerify?: boolean;
  timeoutMs?: number;
}

export interface InvioTsResult {
  success: boolean;
  statusCode: number;
  protocollo?: string;
  esitoChiamata?: string;
  codiceEsito?: string;
  descrizioneEsito?: string;
  errorMessage?: string;
  rawResponse?: string;
}

export interface EsitoTsResult {
  success: boolean;
  statusCode: number;
  protocollo?: string;
  statoElaborazione?: string; // "0" In elaborazione, "2" Accolto, "3" Accolto con segnalazioni, "4"/"5" Scartato
  codiceEsito?: string;
  descrizioneEsito?: string;
  numDocumentiRicevuti?: number;
  numDocumentiAccolti?: number;
  numDocumentiScartati?: number;
  numDocumentiWarnings?: number;
  errorMessage?: string;
  rawResponse?: string;
}

export interface DettaglioErroriResult {
  success: boolean;
  rawCsv?: string;
  message?: string;
}

export interface RicevutaPdfResult {
  success: boolean;
  pdfBuffer?: Buffer;
  message: string;
}
