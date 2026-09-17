import crypto from "node:crypto";

export interface MtomPayload {
  contentTypeHeader: string;
  bodyBuffer: Buffer;
  soapEnvelopeXml: string;
  rootCid: string;
  attachmentCid: string;
}

export function buildSoapInviaFileXml(params: {
  nomeFile: string;
  pincodeCifrato: string;
  codiceRegione?: string | null;
  codiceAsl?: string | null;
  codiceStruttura?: string | null;
  cfProprietario?: string | null;
  attachmentCid?: string;
}): string {
  const attachmentCid = params.attachmentCid || "allegato@sistemats.it";

  const strutturaElem = params.codiceStruttura
    ? `        <codiceSSA>${params.codiceStruttura}</codiceSSA>\n`
    : "";
  const regioneElem = params.codiceRegione
    ? `        <codiceRegione>${params.codiceRegione.padStart(3, "0")}</codiceRegione>\n`
    : "";
  const aslElem = params.codiceAsl
    ? `        <codiceAsl>${params.codiceAsl.padStart(3, "0")}</codiceAsl>\n`
    : "";
  const cfElem = params.cfProprietario
    ? `        <cfProprietario>${params.cfProprietario}</cfProprietario>\n`
    : "";

  let datiProprietarioBlock = "";
  if (regioneElem || aslElem || strutturaElem || cfElem) {
    datiProprietarioBlock =
      "      <datiProprietario>\n" +
      regioneElem +
      aslElem +
      strutturaElem +
      cfElem +
      "      </datiProprietario>\n";
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:inv="http://ejb.invioTelematicoSS730p.sanita.finanze.it/">\n' +
    "  <soapenv:Header/>\n" +
    "  <soapenv:Body>\n" +
    "    <inv:inviaFileMtom>\n" +
    `      <nomeFileAllegato>${params.nomeFile}</nomeFileAllegato>\n` +
    `      <pincodeInvianteCifrato>${params.pincodeCifrato}</pincodeInvianteCifrato>\n` +
    datiProprietarioBlock +
    "      <documento>\n" +
    `        <xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:${attachmentCid}"/>\n` +
    "      </documento>\n" +
    "    </inv:inviaFileMtom>\n" +
    "  </soapenv:Body>\n" +
    "</soapenv:Envelope>"
  );
}

function buildSoapQueryEnvelope(
  tag: string,
  ns: string,
  protocollo: string,
  pincodeCifrato: string,
  namespaceUri?: string
): string {
  const uri = namespaceUri || `http://${tag.toLowerCase()}.p730.sanita.sogei.it/`;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    `xmlns:${ns}="${uri}">\n` +
    "  <soapenv:Header/>\n" +
    "  <soapenv:Body>\n" +
    `    <${ns}:${tag}>\n` +
    "      <DatiInputRichiesta>\n" +
    `        <pinCode>${pincodeCifrato}</pinCode>\n` +
    `        <protocollo>${protocollo}</protocollo>\n` +
    "      </DatiInputRichiesta>\n" +
    `    </${ns}:${tag}>\n` +
    "  </soapenv:Body>\n" +
    "</soapenv:Envelope>"
  );
}

export const buildSoapEsitoXml = (protocollo: string, pincodeCifrato: string) =>
  buildSoapQueryEnvelope(
    "EsitoInvii",
    "esi",
    protocollo,
    pincodeCifrato,
    "http://esitoinvio.p730.sanita.sogei.it/"
  );

export const buildSoapRicevutaPdfXml = (protocollo: string, pincodeCifrato: string) =>
  buildSoapQueryEnvelope("RicevutaPdf", "ric", protocollo, pincodeCifrato);

export const buildSoapDettaglioErroriXml = (protocollo: string, pincodeCifrato: string) =>
  buildSoapQueryEnvelope("DettaglioErrori", "det", protocollo, pincodeCifrato);

/**
 * Incapsula il SOAP Envelope e l'allegato binario ZIP in un payload MIME multipart/related (RFC 2387 MTOM).
 * Utilizza tassativamente delimitatori CRLF (\r\n) conformi agli standard ministeriali.
 */
export function buildMtomMultipart(params: {
  soapXml: string;
  attachmentBytes: Buffer;
  attachmentCid?: string;
  attachmentContentType?: string;
}): MtomPayload {
  const boundaryHex = crypto.randomBytes(16).toString("hex");
  const boundary = `----=_Part_${boundaryHex}`;
  const rootCid = `rootpart_${crypto.randomBytes(6).toString("hex")}@sistemats.it`;
  const attachmentCid = params.attachmentCid || "allegato@sistemats.it";
  const attachmentContentType =
    params.attachmentContentType || "application/octet-stream";

  const contentTypeHeader =
    `multipart/related; type="application/xop+xml"; ` +
    `start="<${rootCid}>"; start-info="text/xml"; boundary="${boundary}"`;

  const part1Header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/xop+xml; charset=UTF-8; type="text/xml"\r\n` +
      `Content-Transfer-Encoding: 8bit\r\n` +
      `Content-ID: <${rootCid}>\r\n\r\n`,
    "ascii"
  );
  const soapXmlBuffer = Buffer.from(params.soapXml, "utf8");
  const part1TrailingCrLf = Buffer.from("\r\n", "ascii");

  const part2Header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: ${attachmentContentType}\r\n` +
      `Content-Transfer-Encoding: binary\r\n` +
      `Content-ID: <${attachmentCid}>\r\n\r\n`,
    "ascii"
  );
  const part2TrailingCrLf = Buffer.from("\r\n", "ascii");

  const closingBoundary = Buffer.from(`--${boundary}--\r\n`, "ascii");

  const bodyBuffer = Buffer.concat([
    part1Header,
    soapXmlBuffer,
    part1TrailingCrLf,
    part2Header,
    params.attachmentBytes,
    part2TrailingCrLf,
    closingBoundary,
  ]);

  return {
    contentTypeHeader,
    bodyBuffer,
    soapEnvelopeXml: params.soapXml,
    rootCid,
    attachmentCid,
  };
}
