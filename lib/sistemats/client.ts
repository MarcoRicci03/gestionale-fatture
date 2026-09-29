import JSZip from "jszip";
import { encryptRsaPkcs1 } from "./crypto";
import {
  buildMtomMultipart,
  buildSoapDettaglioErroriXml,
  buildSoapEsitoXml,
  buildSoapInviaFileXml,
  buildSoapRicevutaPdfXml,
} from "./mtom-builder";
import { Agent } from "undici";
import { parseXml, findTagValue } from "./xml-parser";
import type {
  DettaglioErroriResult,
  EsitoTsResult,
  InvioTsResult,
  RicevutaPdfResult,
  SistemaTsConfig,
} from "./types";
import { MAX_DURATA_INVIO_MS } from "./lock-timing";

const DEFAULT_ENDPOINT_INVIO =
  process.env.SISTEMATS_ENDPOINT_INVIO ||
  "https://invioSS730pTest.sanita.finanze.it/InvioTelematicoSS730pMtomWeb/InvioTelematicoSS730pMtomPort";

const DEFAULT_ENDPOINT_ESITO =
  process.env.SISTEMATS_ENDPOINT_ESITO ||
  "https://invioSS730pTest.sanita.finanze.it/EsitoStatoInviiWEB/EsitoInvioDatiSpesa730Service";

const DEFAULT_ENDPOINT_RICEVUTA =
  process.env.SISTEMATS_ENDPOINT_RICEVUTA ||
  "https://invioSS730pTest.sanita.finanze.it/Ricevute730ServiceWeb/ricevutePdf";

const DEFAULT_ENDPOINT_ERRORI =
  process.env.SISTEMATS_ENDPOINT_ERRORI ||
  "https://invioSS730pTest.sanita.finanze.it/EsitoStatoInviiWEB/DettaglioErrori730Service";

function verifyEndpointSafety(endpoint: string): void {
  // P030: il controllo guarda solo l'hostname. Sull'URL intera bastava un
  // path come ".../latest/..." per far passare un endpoint di produzione.
  let host = "";
  try {
    host = new URL(endpoint).hostname.toLowerCase();
  } catch {
    // URL non valida: trattata come non di test.
  }
  const isSafeTest =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.includes("test") ||
    host.includes("mock");
  const allowProd =
    (process.env.SISTEMATS_ALLOW_PRODUCTION || "false").toLowerCase() === "true";

  if (!isSafeTest && !allowProd) {
    throw new Error(
      `[BLOCCO DI SICUREZZA] L'endpoint configurato (${endpoint}) non sembra un ambiente di TEST. ` +
        `Per prevenire trasmissioni accidentali verso la produzione reale, la chiamata è stata interrotta. ` +
        `Imposta SISTEMATS_ALLOW_PRODUCTION=true per abilitare l'invio in produzione.`
    );
  }
}

export class RetryableHttpError extends Error {
  constructor(
    public statusCode: number,
    public responseBody: string
  ) {
    super(`HTTP ${statusCode}: Errore temporaneo del server Sistema TS`);
    this.name = "RetryableHttpError";
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RetryableHttpError) {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return true;
    }
    const msg = error.message.toLowerCase();
    if (
      msg.includes("timeout") ||
      msg.includes("fetch failed") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("econnrefused") ||
      msg.includes("socket") ||
      msg.includes("network")
    ) {
      return true;
    }
    if ("cause" in error && error.cause) {
      return isRetryableError(error.cause);
    }
  }
  return false;
}

// Errori che garantiscono che la richiesta NON è stata accettata da Sogei
// (connessione mai stabilita).
const PRE_SEND_ERROR_CODES = ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"];

// CR-01: inviaFile non è idempotente — ogni invio accolto genera un nuovo
// protocollo. Un timeout, un ECONNRESET o un 502/504 possono arrivare DOPO
// che Sogei ha già ricevuto il file: ritentare produrrebbe un lotto
// duplicato. Qui si ritenta solo quando è certo che il file non è arrivato:
// connessione mai stabilita o rifiuto esplicito del server (429/503).
export function isSafeToRetrySubmission(error: unknown): boolean {
  if (error instanceof RetryableHttpError) {
    return error.statusCode === 429 || error.statusCode === 503;
  }
  if (typeof error !== "object" || error === null) return false;

  const code = "code" in error ? String(error.code).toUpperCase() : "";
  const message = error instanceof Error ? error.message.toUpperCase() : "";
  if (PRE_SEND_ERROR_CODES.some((c) => code === c || message.includes(c))) {
    return true;
  }
  if ("cause" in error && error.cause) {
    return isSafeToRetrySubmission(error.cause);
  }
  return false;
}

function formatErrorWithCause(error: unknown, timeoutMs = 120_000): string {
  if (error instanceof RetryableHttpError) {
    return `Server temporaneamente non disponibile (HTTP ${error.statusCode}). Riprova più tardi.`;
  }
  if (error instanceof Error) {
    if (
      error.name === "TimeoutError" ||
      error.message.toLowerCase().includes("timeout") ||
      error.message.toLowerCase().includes("aborted")
    ) {
      const seconds = Math.round(timeoutMs / 1000);
      return `Timeout: il server del Sistema TS non ha risposto entro ${seconds} secondi. Riprova più tardi.`;
    }
    const cause = "cause" in error && error.cause ? ` (${String(error.cause)})` : "";
    return `${error.message}${cause}`;
  }
  return String(error);
}

export class SistemaTsClient {
  private config: SistemaTsConfig;
  private dispatcher?: Agent;

  constructor(config: SistemaTsConfig) {
    this.config = config;

    const isProd = process.env.NODE_ENV === "production";
    const envTlsVerify = process.env.SISTEMATS_TLS_VERIFY;

    // Secure by Default: la verifica TLS è sempre attiva di default.
    // Può essere disattivata SOLO se esplicitamente impostata a false via config
    // o tramite SISTEMATS_TLS_VERIFY="false" / "0" (ad es. per server mock locali).
    const shouldVerify =
      config.tlsVerify !== undefined
        ? config.tlsVerify
        : envTlsVerify !== undefined
          ? envTlsVerify.toLowerCase() !== "false" && envTlsVerify !== "0"
          : true;

    if (!shouldVerify) {
      if (isProd) {
        throw new Error(
          "[BLOCCO DI SICUREZZA] La disattivazione della verifica TLS (rejectUnauthorized: false) è vietata in ambiente di produzione (NODE_ENV=production)."
        );
      }
      this.dispatcher = new Agent({
        connect: {
          rejectUnauthorized: false,
        },
      });
    }
  }

  private getMaxRetries(): number {
    if (this.config.maxRetries !== undefined && this.config.maxRetries >= 0) {
      return this.config.maxRetries;
    }
    if (process.env.SISTEMATS_MAX_RETRIES) {
      const parsed = parseInt(process.env.SISTEMATS_MAX_RETRIES, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 2;
  }

  private getRetryDelayMs(): number {
    if (this.config.retryBaseDelayMs !== undefined && this.config.retryBaseDelayMs >= 0) {
      return this.config.retryBaseDelayMs;
    }
    if (process.env.SISTEMATS_RETRY_DELAY_MS) {
      const parsed = parseInt(process.env.SISTEMATS_RETRY_DELAY_MS, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return process.env.NODE_ENV === "test" ? 10 : 1000;
  }

  private isRetryableHttpStatus(status: number): boolean {
    return status === 429 || status === 502 || status === 503 || status === 504;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    formatError: (error: unknown) => T,
    shouldRetry: (error: unknown) => boolean = isRetryableError,
    // CR-11: se indicato, un nuovo tentativo parte solo se attesa + tentativo
    // intero (attemptMs) stanno ancora entro totalMs. Nessun tentativo viene
    // accorciato: un timeout anticipato renderebbe incerto l'esito.
    budget?: { totalMs: number; attemptMs: number }
  ): Promise<T> {
    const maxRetries = this.getMaxRetries();
    const baseDelay = this.getRetryDelayMs();
    const startedAt = Date.now();

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries && shouldRetry(error)) {
          const delay = baseDelay * Math.pow(2, attempt);
          if (
            budget &&
            Date.now() - startedAt + delay + budget.attemptMs > budget.totalMs
          ) {
            break;
          }
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          continue;
        }
        break;
      }
    }

    return formatError(lastError);
  }

  private getTimeoutMs(): number {
    if (this.config.timeoutMs) return this.config.timeoutMs;
    if (process.env.SISTEMATS_TIMEOUT_MS) {
      const parsed = parseInt(process.env.SISTEMATS_TIMEOUT_MS, 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return 120_000;
  }

  private getBasicAuthHeader(): string {
    const creds = `${this.config.username}:${this.config.passwordDecrypted}`;
    return `Basic ${Buffer.from(creds).toString("base64")}`;
  }

  /**
   * Invia il pacchetto ZIP contenente le fatture al Web Service Asincrono
   * InvioTelematicoSS730pMtom tramite SOAP MTOM e recupera il numero di protocollo.
   */
  async inviaFile(
    zipBytes: Buffer,
    nomeFile: string = "730.zip"
  ): Promise<InvioTsResult> {
    const endpoint = this.config.endpointInvio || DEFAULT_ENDPOINT_INVIO;
    verifyEndpointSafety(endpoint);

    const pincodeCifrato = encryptRsaPkcs1(
      this.config.pincodeDecrypted,
      this.config.certPath
    );

    const attachmentCid = `${nomeFile}@sistemats.it`;
    const soapXml = buildSoapInviaFileXml({
      nomeFile,
      pincodeCifrato,
      codiceRegione: this.config.codiceRegione,
      codiceAsl: this.config.codiceAsl,
      codiceStruttura: this.config.codiceStruttura,
      cfProprietario: this.config.cfProprietario,
      attachmentCid,
    });

    const mtomPayload = buildMtomMultipart({
      soapXml,
      attachmentBytes: zipBytes,
      attachmentCid,
    });

    // CR-11: nessun tentativo può superare da solo la durata massima.
    const maxDurataMs = this.config.maxDurataInvioMs ?? MAX_DURATA_INVIO_MS;
    const timeoutMs = Math.min(this.getTimeoutMs(), maxDurataMs);

    return this.executeWithRetry(
      async () => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": mtomPayload.contentTypeHeader,
            SOAPAction: '""',
            Authorization: this.getBasicAuthHeader(),
            "User-Agent": "SistemaTS-TypeScript-Client/2.5",
          },
          body: new Uint8Array(mtomPayload.bodyBuffer),
          signal: AbortSignal.timeout(timeoutMs),
          ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
        } as RequestInit);

        if (this.isRetryableHttpStatus(response.status)) {
          throw new RetryableHttpError(response.status, await response.text());
        }

        const responseText = await response.text();
        return this.parseInvioResponse(responseText, response.status);
      },
      (error) => ({
        success: false,
        statusCode: error instanceof RetryableHttpError ? error.statusCode : 0,
        errorMessage: `Errore di rete durante la trasmissione a Sistema TS: ${formatErrorWithCause(error, timeoutMs)}`,
        esitoIncerto: !isSafeToRetrySubmission(error),
      }),
      isSafeToRetrySubmission,
      { totalMs: maxDurataMs, attemptMs: timeoutMs }
    );
  }

  /**
   * Interroga lo stato di elaborazione della trasmissione identificata dal numero di protocollo.
   */
  async interrogaEsito(
    protocollo: string
  ): Promise<EsitoTsResult> {
    const endpoint = this.config.endpointEsito || DEFAULT_ENDPOINT_ESITO;
    verifyEndpointSafety(endpoint);

    const pincodeCifrato = encryptRsaPkcs1(
      this.config.pincodeDecrypted,
      this.config.certPath
    );

    const soapXml = buildSoapEsitoXml(protocollo, pincodeCifrato);
    const timeoutMs = this.getTimeoutMs();

    return this.executeWithRetry(
      async () => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: '""',
            Authorization: this.getBasicAuthHeader(),
            "User-Agent": "SistemaTS-TypeScript-Client/2.5",
          },
          body: soapXml,
          signal: AbortSignal.timeout(timeoutMs),
          ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
        } as RequestInit);

        if (this.isRetryableHttpStatus(response.status)) {
          throw new RetryableHttpError(response.status, await response.text());
        }

        const responseText = await response.text();
        return this.parseEsitoResponse(responseText, response.status, protocollo);
      },
      (error) => ({
        success: false,
        statusCode: error instanceof RetryableHttpError ? error.statusCode : 0,
        errorMessage: `Errore durante l'interrogazione dell'esito per il protocollo ${protocollo}: ${formatErrorWithCause(error, timeoutMs)}`,
      })
    );
  }

  /**
   * Scarica la ricevuta PDF ufficiale rilasciata dal Sistema TS.
   */
  async scaricaRicevutaPdf(
    protocollo: string
  ): Promise<RicevutaPdfResult> {
    const endpoint = this.config.endpointRicevuta || DEFAULT_ENDPOINT_RICEVUTA;
    verifyEndpointSafety(endpoint);

    const pincodeCifrato = encryptRsaPkcs1(
      this.config.pincodeDecrypted,
      this.config.certPath
    );

    const soapXml = buildSoapRicevutaPdfXml(protocollo, pincodeCifrato);
    const timeoutMs = this.getTimeoutMs();

    return this.executeWithRetry(
      async () => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: '""',
            Authorization: this.getBasicAuthHeader(),
            "User-Agent": "SistemaTS-TypeScript-Client/2.5",
          },
          body: soapXml,
          signal: AbortSignal.timeout(timeoutMs),
          ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
        } as RequestInit);

        if (this.isRetryableHttpStatus(response.status)) {
          throw new RetryableHttpError(response.status, await response.text());
        }

        if (!response.ok) {
          return {
            success: false,
            message: `HTTP Error ${response.status}: ${await response.text()}`,
          };
        }

        const responseText = await response.text();
        const parsed = parseXml(responseText);
        const pdfBase64 = findTagValue(parsed, "pdf");

        if (pdfBase64) {
          const pdfBuffer = Buffer.from(pdfBase64, "base64");
          return { success: true, pdfBuffer, message: "Ricevuta PDF scaricata con successo." };
        }

        const desc = findTagValue(parsed, "descrizione") || findTagValue(parsed, "faultstring");
        return {
          success: false,
          message: desc || "Nessun contenuto PDF restituito dal servizio ricevute.",
        };
      },
      (error) => ({
        success: false,
        message: `Errore durante lo scaricamento della ricevuta PDF: ${formatErrorWithCause(error, timeoutMs)}`,
      })
    );
  }

  /**
   * Scarica il report dettagliato di errori o segnalazioni dal servizio DettaglioErrori730Service.
   */
  async scaricaDettaglioErrori(
    protocollo: string
  ): Promise<DettaglioErroriResult> {
    const endpoint = this.config.endpointErrori || DEFAULT_ENDPOINT_ERRORI;
    verifyEndpointSafety(endpoint);

    const pincodeCifrato = encryptRsaPkcs1(
      this.config.pincodeDecrypted,
      this.config.certPath
    );

    const soapXml = buildSoapDettaglioErroriXml(protocollo, pincodeCifrato);
    const timeoutMs = this.getTimeoutMs();

    return this.executeWithRetry(
      async () => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: '""',
            Authorization: this.getBasicAuthHeader(),
            "User-Agent": "SistemaTS-TypeScript-Client/2.5",
          },
          body: soapXml,
          signal: AbortSignal.timeout(timeoutMs),
          ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
        } as RequestInit);

        if (this.isRetryableHttpStatus(response.status)) {
          throw new RetryableHttpError(response.status, await response.text());
        }

        if (!response.ok) {
          return {
            success: false,
            message: `HTTP Error ${response.status}: ${await response.text()}`,
          };
        }

        const responseText = await response.text();
        const parsed = parseXml(responseText);

        // Esito WS11 = Assenza di errori
        const codNegativo = findTagValue(parsed, "codice");
        if (codNegativo === "WS11") {
          return {
            success: true,
            message: "Non sono presenti errori o segnalazioni per questa trasmissione.",
          };
        }

        const csvBase64 = findTagValue(parsed, "csv");
        if (!csvBase64) {
          const fault = findTagValue(parsed, "faultstring") || findTagValue(parsed, "descrizione");
          return {
            success: false,
            message: fault || "Nessun dato CSV restituito dal server.",
          };
        }

        const rawBytes = Buffer.from(csvBase64, "base64");
        let csvText = "";

        // Verifica se i byte sono un archivio ZIP
        if (rawBytes.length >= 4 && rawBytes[0] === 0x50 && rawBytes[1] === 0x4b) {
          const zip = await JSZip.loadAsync(rawBytes);
          const csvFile = Object.values(zip.files).find((f) =>
            f.name.toLowerCase().endsWith(".csv")
          );
          const targetFile = csvFile ?? Object.values(zip.files)[0];
          if (targetFile) {
            const buf = await targetFile.async("nodebuffer");
            csvText = buf.toString("latin1");
          }
        } else {
          csvText = rawBytes.toString("latin1");
        }

        return {
          success: true,
          rawCsv: csvText,
        };
      },
      (error) => ({
        success: false,
        message: `Errore durante il recupero degli errori: ${formatErrorWithCause(error, timeoutMs)}`,
      })
    );
  }

  private parseInvioResponse(responseText: string, statusCode: number): InvioTsResult {
    const parsed = parseXml(responseText);
    const fault = findTagValue(parsed, "faultstring");
    if (fault) {
      return {
        success: false,
        statusCode,
        errorMessage: `SOAP Fault: ${fault}`,
        rawResponse: responseText,
      };
    }

    const protocollo = findTagValue(parsed, "protocollo");
    const esitoChiamata = findTagValue(parsed, "esitoChiamata");
    const codiceEsito = findTagValue(parsed, "codiceEsito");
    const descrizioneEsito = findTagValue(parsed, "descrizioneEsito");

    // Successo se protocollo presente e codiceEsito non è errore bloccante ("000" = accolto in elaborazione, "00", "0", "WS11")
    const isSuccess =
      !!protocollo &&
      (!codiceEsito ||
        codiceEsito === "000" ||
        codiceEsito === "00" ||
        codiceEsito === "0" ||
        codiceEsito === "WS11");

    return {
      success: isSuccess,
      statusCode,
      protocollo,
      esitoChiamata,
      codiceEsito,
      descrizioneEsito,
      errorMessage: !isSuccess ? (descrizioneEsito || `Codice errore: ${codiceEsito}`) : undefined,
      rawResponse: responseText,
    };
  }

  private parseEsitoResponse(
    responseText: string,
    statusCode: number,
    protocollo: string
  ): EsitoTsResult {
    const parsed = parseXml(responseText);
    const fault = findTagValue(parsed, "faultstring");
    if (fault) {
      return {
        success: false,
        statusCode,
        protocollo,
        errorMessage: `SOAP Fault: ${fault}`,
        rawResponse: responseText,
      };
    }

    const stato =
      findTagValue(parsed, "stato") ||
      findTagValue(parsed, "statoElaborazione") ||
      findTagValue(parsed, "esito");
    const codiceEsito =
      findTagValue(parsed, "esitoChiamata") ||
      findTagValue(parsed, "codiceEsito");
    const descrizioneEsito =
      findTagValue(parsed, "descrizione") ||
      findTagValue(parsed, "descrizioneEsito");

    const numRicevutiStr =
      findTagValue(parsed, "nInviati") ||
      findTagValue(parsed, "numDocumentiRicevuti");
    const numAccoltiStr =
      findTagValue(parsed, "nAccolti") ||
      findTagValue(parsed, "numDocumentiAccolti");
    const numScartatiStr =
      findTagValue(parsed, "nErrori") ||
      findTagValue(parsed, "numDocumentiScartati");
    const numWarningsStr = findTagValue(parsed, "nWarnings");

    return {
      success: true,
      statusCode,
      protocollo,
      statoElaborazione: stato,
      codiceEsito,
      descrizioneEsito: descrizioneEsito?.trim() || undefined,
      numDocumentiRicevuti: numRicevutiStr ? parseInt(numRicevutiStr, 10) : undefined,
      numDocumentiAccolti: numAccoltiStr ? parseInt(numAccoltiStr, 10) : undefined,
      numDocumentiScartati: numScartatiStr ? parseInt(numScartatiStr, 10) : undefined,
      numDocumentiWarnings: numWarningsStr ? parseInt(numWarningsStr, 10) : undefined,
      rawResponse: responseText,
    };
  }
}
