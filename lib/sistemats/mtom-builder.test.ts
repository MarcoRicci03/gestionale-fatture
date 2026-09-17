import { describe, expect, it } from "vitest";
import {
  buildMtomMultipart,
  buildSoapDettaglioErroriXml,
  buildSoapEsitoXml,
  buildSoapInviaFileXml,
  buildSoapRicevutaPdfXml,
} from "./mtom-builder";

describe("mtom-builder — SOAP envelopes e MIME multipart/related", () => {
  it("costruisce l'envelope SOAP per inviaFileMtom", () => {
    const soap = buildSoapInviaFileXml({
      nomeFile: "730.zip",
      pincodeCifrato: "PIN_B64",
      codiceRegione: "000",
      codiceAsl: "000",
      cfProprietario: "CF_B64",
    });

    expect(soap).toContain("<nomeFileAllegato>730.zip</nomeFileAllegato>");
    expect(soap).toContain("<pincodeInvianteCifrato>PIN_B64</pincodeInvianteCifrato>");
    expect(soap).toContain("<codiceRegione>000</codiceRegione>");
    expect(soap).toContain("<xop:Include");
  });

  it("costruisce l'envelope SOAP per interrogazione esito", () => {
    const soap = buildSoapEsitoXml("PROT12345", "PIN_B64");
    expect(soap).toContain("<protocollo>PROT12345</protocollo>");
    expect(soap).toContain("<pinCode>PIN_B64</pinCode>");
    expect(soap).toContain('xmlns:esi="http://esitoinvio.p730.sanita.sogei.it/"');
  });

  it("costruisce l'envelope SOAP per download ricevuta PDF", () => {
    const soap = buildSoapRicevutaPdfXml("PROT12345", "PIN_B64");
    expect(soap).toContain("<protocollo>PROT12345</protocollo>");
    expect(soap).toContain("<ric:RicevutaPdf>");
  });

  it("costruisce l'envelope SOAP per dettaglio errori", () => {
    const soap = buildSoapDettaglioErroriXml("PROT12345", "PIN_B64");
    expect(soap).toContain("<protocollo>PROT12345</protocollo>");
    expect(soap).toContain("<det:DettaglioErrori>");
  });

  it("incapsula correttamente in multipart/related MTOM RFC 2387", () => {
    const soapXml = "<testSoap>Hello</testSoap>";
    const dummyZip = Buffer.from("DUMMY_ZIP_DATA");

    const payload = buildMtomMultipart({
      soapXml,
      attachmentBytes: dummyZip,
    });

    expect(payload.contentTypeHeader).toContain('multipart/related; type="application/xop+xml"');
    expect(payload.bodyBuffer).toBeInstanceOf(Buffer);

    const bodyStr = payload.bodyBuffer.toString("utf8");
    expect(bodyStr).toContain(soapXml);
    expect(bodyStr).toContain("DUMMY_ZIP_DATA");
    expect(bodyStr).toContain("Content-Type: application/xop+xml");
    expect(bodyStr).toContain("Content-Type: application/octet-stream");
  });
});
