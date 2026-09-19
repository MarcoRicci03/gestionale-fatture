import { describe, it, expect } from "vitest";
import {
  parseXml,
  findTagValue,
  extractTagValueFromXml,
} from "./xml-parser";

describe("lib/sistemats/xml-parser", () => {
  describe("parseXml", () => {
    it("parsa un SOAP Envelope con prefissi di namespace rimuovendoli", () => {
      const xml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <esi:esito xmlns:esi="http://esitoinvio.p730.sanita.sogei.it/">
            <esi:protocollo>PROT12345</esi:protocollo>
            <esi:stato>2</esi:stato>
          </esi:esito>
        </soapenv:Body>
      </soapenv:Envelope>`;

      const parsed = parseXml(xml);
      expect(parsed).toHaveProperty("Envelope");
      const envelope = parsed.Envelope as Record<string, unknown>;
      expect(envelope).toHaveProperty("Body");
    });

    it("restituisce un oggetto vuoto se l'input è vuoto o spazi bianchi", () => {
      expect(parseXml("")).toEqual({});
      expect(parseXml("   \n\t  ")).toEqual({});
      expect(parseXml(null as unknown as string)).toEqual({});
      expect(parseXml(undefined as unknown as string)).toEqual({});
    });

    it("gestisce XML malformato o non valido senza lanciare eccezioni", () => {
      expect(() => parseXml("<unclosed-tag>")).not.toThrow();
      expect(() => parseXml("<<<invalid>>")).not.toThrow();
      expect(findTagValue(parseXml("<<<invalid>>"), "protocollo")).toBeUndefined();
    });
  });

  describe("findTagValue", () => {
    it("estrae correttamente i valori dei tag in modo case-insensitive", () => {
      const xml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <esito>
            <protocollo>PROT999</protocollo>
            <descrizioneEsito>Acquisito con successo</descrizioneEsito>
          </esito>
        </soapenv:Body>
      </soapenv:Envelope>`;

      const parsed = parseXml(xml);
      expect(findTagValue(parsed, "protocollo")).toBe("PROT999");
      expect(findTagValue(parsed, "PROTOCOLLO")).toBe("PROT999");
      expect(findTagValue(parsed, "Protocollo")).toBe("PROT999");
      expect(findTagValue(parsed, "descrizioneesito")).toBe("Acquisito con successo");
      expect(findTagValue(parsed, "nonEsistente")).toBeUndefined();
    });

    it("preserva le stringhe con zeri iniziali (es. '000', '00', '0')", () => {
      const xml = `<esito>
        <codiceEsito>000</codiceEsito>
        <altroCodice>00</altroCodice>
        <protocollo>000123456</protocollo>
      </esito>`;

      const parsed = parseXml(xml);
      expect(findTagValue(parsed, "codiceEsito")).toBe("000");
      expect(findTagValue(parsed, "altroCodice")).toBe("00");
      expect(findTagValue(parsed, "protocollo")).toBe("000123456");
    });

    it("gestisce correttamente i tag auto-chiusi restituendo stringa vuota", () => {
      const xml = `<esito>
        <protocollo>PROT1</protocollo>
        <dettaglioErrori />
        <segnalazioni/>
      </esito>`;

      const parsed = parseXml(xml);
      expect(findTagValue(parsed, "dettaglioErrori")).toBe("");
      expect(findTagValue(parsed, "segnalazioni")).toBe("");
      expect(findTagValue(parsed, "protocollo")).toBe("PROT1");
    });

    it("decodifica automaticamente le entità XML standard (&amp;, &lt;, &gt;, &quot;, &apos;)", () => {
      const xml = `<esito>
        <descrizione>Fattura &amp; Ricevuta per importo &lt; 100 &gt; 50 &quot;speciale&quot; &apos;paziente&apos;</descrizione>
      </esito>`;

      const parsed = parseXml(xml);
      expect(findTagValue(parsed, "descrizione")).toBe(
        `Fattura & Ricevuta per importo < 100 > 50 "speciale" 'paziente'`
      );
    });

    it("estrae correttamente il contenuto di sezioni CDATA", () => {
      const xml = `<esito>
        <dati><![CDATA[Contenuto con caratteri speciali: <tag> & altro]]></dati>
      </esito>`;

      const parsed = parseXml(xml);
      expect(findTagValue(parsed, "dati")).toBe("Contenuto con caratteri speciali: <tag> & altro");
    });

    it("estrae faultstring e faultcode da un SOAP Fault", () => {
      const faultXml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <soapenv:Fault>
            <faultcode>soapenv:Server</faultcode>
            <faultstring>Credenziali non valide o utente bloccato</faultstring>
          </soapenv:Fault>
        </soapenv:Body>
      </soapenv:Envelope>`;

      const parsed = parseXml(faultXml);
      expect(findTagValue(parsed, "faultstring")).toBe("Credenziali non valide o utente bloccato");
      expect(findTagValue(parsed, "faultcode")).toBe("soapenv:Server");
    });

    it("cerca ricorsivamente in nodi annidati e array di nodi", () => {
      const xml = `<root>
        <livello1>
          <livello2>
            <item>
              <id>1</id>
              <valore>Primo</valore>
            </item>
            <item>
              <id>2</id>
              <valore>Secondo</valore>
            </item>
          </livello2>
        </livello1>
      </root>`;

      const parsed = parseXml(xml);
      expect(findTagValue(parsed, "id")).toBe("1");
      expect(findTagValue(parsed, "valore")).toBe("Primo");
    });

    it("non restituisce oggetti se il tag cercato è un nodo contenitore non foglia", () => {
      const xml = `<root>
        <esito>
          <stato>2</stato>
        </esito>
      </root>`;

      const parsed = parseXml(xml);
      // 'esito' è un contenitore che contiene 'stato', non un valore foglia
      expect(findTagValue(parsed, "esito")).toBeUndefined();
      expect(findTagValue(parsed, "stato")).toBe("2");
    });
  });

  describe("extractTagValueFromXml", () => {
    it("helper diretto per estrarre valori da stringa XML", () => {
      const xml = `<response><codice>WS11</codice></response>`;
      expect(extractTagValueFromXml(xml, "codice")).toBe("WS11");
      expect(extractTagValueFromXml(xml, "assente")).toBeUndefined();
    });
  });
});
