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
import type {
  DettaglioErroriResult,
  EsitoTsResult,
  InvioTsResult,
  RicevutaPdfResult,
  SistemaTsConfig,
} from "./types";

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

function extractTagValue(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

function verifyEndpointSafety(endpoint: string): void {
  const isSafeTest = ["test", "localhost", "127.0.0.1", "mock"].some((token) =>
    endpoint.toLowerCase().includes(token)
  );
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

function formatErrorWithCause(error: unknown, timeoutMs = 120_000): string {
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

    const timeoutMs = this.getTimeoutMs();
    try {
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

      const responseText = await response.text();
      return this.parseInvioResponse(responseText, response.status);
    } catch (error) {
      return {
        success: false,
        statusCode: 0,
        errorMessage: `Errore di rete durante la trasmissione a Sistema TS: ${formatErrorWithCause(error, timeoutMs)}`,
      };
    }
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
    try {
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

      const responseText = await response.text();
      return this.parseEsitoResponse(responseText, response.status, protocollo);
    } catch (error) {
      return {
        success: false,
        statusCode: 0,
        errorMessage: `Errore durante l'interrogazione dell'esito per il protocollo ${protocollo}: ${formatErrorWithCause(error, timeoutMs)}`,
      };
    }
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
    try {
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

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP Error ${response.status}: ${await response.text()}`,
        };
      }

      const responseText = await response.text();
      const pdfBase64 = extractTagValue(responseText, "pdf");

      if (pdfBase64) {
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        return { success: true, pdfBuffer, message: "Ricevuta PDF scaricata con successo." };
      }

      const desc = extractTagValue(responseText, "descrizione") || extractTagValue(responseText, "faultstring");
      return {
        success: false,
        message: desc || "Nessun contenuto PDF restituito dal servizio ricevute.",
      };
    } catch (error) {
      return {
        success: false,
        message: `Errore durante lo scaricamento della ricevuta PDF: ${formatErrorWithCause(error, timeoutMs)}`,
      };
    }
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
    try {
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

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP Error ${response.status}: ${await response.text()}`,
        };
      }

      const responseText = await response.text();

      // Esito WS11 = Assenza di errori
      const codNegativo = extractTagValue(responseText, "codice");
      if (codNegativo === "WS11") {
        return {
          success: true,
          message: "Non sono presenti errori o segnalazioni per questa trasmissione.",
        };
      }

      const csvBase64 = extractTagValue(responseText, "csv");
      if (!csvBase64) {
        const fault = extractTagValue(responseText, "faultstring") || extractTagValue(responseText, "descrizione");
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
    } catch (error) {
      return {
        success: false,
        message: `Errore durante il recupero degli errori: ${formatErrorWithCause(error, timeoutMs)}`,
      };
    }
  }

  private parseInvioResponse(responseText: string, statusCode: number): InvioTsResult {
    const fault = extractTagValue(responseText, "faultstring");
    if (fault) {
      return {
        success: false,
        statusCode,
        errorMessage: `SOAP Fault: ${fault}`,
        rawResponse: responseText,
      };
    }

    const protocollo = extractTagValue(responseText, "protocollo");
    const esitoChiamata = extractTagValue(responseText, "esitoChiamata");
    const codiceEsito = extractTagValue(responseText, "codiceEsito");
    const descrizioneEsito = extractTagValue(responseText, "descrizioneEsito");

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
    const fault = extractTagValue(responseText, "faultstring");
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
      extractTagValue(responseText, "stato") ||
      extractTagValue(responseText, "statoElaborazione") ||
      extractTagValue(responseText, "esito");
    const codiceEsito =
      extractTagValue(responseText, "esitoChiamata") ||
      extractTagValue(responseText, "codiceEsito");
    const descrizioneEsito =
      extractTagValue(responseText, "descrizione") ||
      extractTagValue(responseText, "descrizioneEsito");

    const numRicevutiStr =
      extractTagValue(responseText, "nInviati") ||
      extractTagValue(responseText, "numDocumentiRicevuti");
    const numAccoltiStr =
      extractTagValue(responseText, "nAccolti") ||
      extractTagValue(responseText, "numDocumentiAccolti");
    const numScartatiStr =
      extractTagValue(responseText, "nErrori") ||
      extractTagValue(responseText, "numDocumentiScartati");
    const numWarningsStr = extractTagValue(responseText, "nWarnings");

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
