import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { isSafeToRetrySubmission, RetryableHttpError, SistemaTsClient } from "./client";
import type { SistemaTsConfig } from "./types";
import { MAX_DURATA_INVIO_MS, STALE_LOCK_MINUTES } from "./lock-timing";

const mockConfig: SistemaTsConfig = {
  username: "testuser",
  passwordDecrypted: "testpass",
  pincodeDecrypted: "testpin",
  cfProprietario: "RSSMRA80A01H501Z",
};

describe("SistemaTsClient — TLS Verification Security", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.SISTEMATS_TLS_VERIFY;
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("abilita la verifica TLS di default (nessun custom dispatcher insicuro creato)", () => {
    const client = new SistemaTsClient(mockConfig);
    const dispatcher = (client as unknown as { dispatcher?: unknown }).dispatcher;
    expect(dispatcher).toBeUndefined();
  });

  it("mantiene la verifica TLS se config.tlsVerify è true", () => {
    const client = new SistemaTsClient({ ...mockConfig, tlsVerify: true });
    const dispatcher = (client as unknown as { dispatcher?: unknown }).dispatcher;
    expect(dispatcher).toBeUndefined();
  });

  it("mantiene la verifica TLS se SISTEMATS_TLS_VERIFY='true'", () => {
    vi.stubEnv("SISTEMATS_TLS_VERIFY", "true");
    const client = new SistemaTsClient(mockConfig);
    const dispatcher = (client as unknown as { dispatcher?: unknown }).dispatcher;
    expect(dispatcher).toBeUndefined();
  });

  it("disabilita la verifica TLS se config.tlsVerify è false in sviluppo/test", () => {
    vi.stubEnv("NODE_ENV", "development");
    const client = new SistemaTsClient({ ...mockConfig, tlsVerify: false });
    const dispatcher = (client as unknown as { dispatcher?: unknown }).dispatcher;
    expect(dispatcher).toBeDefined();
  });

  it("disabilita la verifica TLS se SISTEMATS_TLS_VERIFY='false' in sviluppo/test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SISTEMATS_TLS_VERIFY", "false");
    const client = new SistemaTsClient(mockConfig);
    const dispatcher = (client as unknown as { dispatcher?: unknown }).dispatcher;
    expect(dispatcher).toBeDefined();
  });

  it("disabilita la verifica TLS se SISTEMATS_TLS_VERIFY='0' in sviluppo/test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SISTEMATS_TLS_VERIFY", "0");
    const client = new SistemaTsClient(mockConfig);
    const dispatcher = (client as unknown as { dispatcher?: unknown }).dispatcher;
    expect(dispatcher).toBeDefined();
  });

  it("in produzione consente la creazione del client con la configurazione di default (TLS attivo)", () => {
    vi.stubEnv("NODE_ENV", "production");
    const client = new SistemaTsClient(mockConfig);
    const dispatcher = (client as unknown as { dispatcher?: unknown }).dispatcher;
    expect(dispatcher).toBeUndefined();
  });

  it("blocca la creazione del client se si tenta di disattivare TLS via config in produzione (NODE_ENV=production)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => {
      new SistemaTsClient({ ...mockConfig, tlsVerify: false });
    }).toThrow(/\[BLOCCO DI SICUREZZA\]/);
  });

  it("blocca la creazione del client se si tenta di disattivare TLS via env in produzione (NODE_ENV=production)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SISTEMATS_TLS_VERIFY", "false");
    expect(() => {
      new SistemaTsClient(mockConfig);
    }).toThrow(/\[BLOCCO DI SICUREZZA\]/);
  });
});

describe("SistemaTsClient — scaricaDettaglioErrori encoding", () => {
  it("decodifica correttamente caratteri accentati ISO-8859-1 (Latin1) da file CSV dentro uno ZIP", async () => {
    const zip = new JSZip();
    // Testo con lettere accentate italiane: "È la società"
    const textWithAccents = "1;S001;È la società;ERRORE";
    const latin1Buffer = Buffer.from(textWithAccents, "latin1");
    zip.file("errori.csv", latin1Buffer);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const base64Zip = zipBuffer.toString("base64");

    const soapResponse = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body>
        <esito>
          <csv>${base64Zip}</csv>
        </esito>
      </soapenv:Body>
    </soapenv:Envelope>`;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => soapResponse,
    })) as unknown as typeof fetch;

    try {
      const client = new SistemaTsClient(mockConfig);
      const res = await client.scaricaDettaglioErrori("PROT123");
      expect(res.success).toBe(true);
      expect(res.rawCsv).toContain("È la società");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("SistemaTsClient — Retry Policy (H4)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("inviaFile esegue retry con successo se la connessione è stata rifiutata (ECONNREFUSED)", async () => {
    let callCount = 0;
    const okSoapResponse = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body>
        <esito>
          <protocollo>PROT_RETRY_OK</protocollo>
          <codice>0</codice>
          <descrizione>Acquisito</descrizione>
        </esito>
      </soapenv:Body>
    </soapenv:Envelope>`;

    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
      }
      return {
        ok: true,
        status: 200,
        text: async () => okSoapResponse,
      };
    }) as unknown as typeof fetch;

    const client = new SistemaTsClient({ ...mockConfig, maxRetries: 2, retryBaseDelayMs: 5 });
    const res = await client.inviaFile(Buffer.from("dummy-zip"), "test.zip");

    expect(callCount).toBe(2);
    expect(res.success).toBe(true);
    expect(res.protocollo).toBe("PROT_RETRY_OK");
  });

  it("esegue retry con successo dopo un timeout (TimeoutError)", async () => {
    let callCount = 0;
    const okSoapResponse = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body>
        <esito>
          <stato>2</stato>
          <descrizione>Accolto</descrizione>
        </esito>
      </soapenv:Body>
    </soapenv:Envelope>`;

    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        const err = new Error("The operation was aborted due to timeout");
        err.name = "TimeoutError";
        throw err;
      }
      return {
        ok: true,
        status: 200,
        text: async () => okSoapResponse,
      };
    }) as unknown as typeof fetch;

    const client = new SistemaTsClient({ ...mockConfig, maxRetries: 2, retryBaseDelayMs: 5 });
    const res = await client.interrogaEsito("PROT_TIMEOUT_RETRY");

    expect(callCount).toBe(2);
    expect(res.success).toBe(true);
    expect(res.statoElaborazione).toBe("2");
  });

  it("esegue retry con successo su errore HTTP 503 Service Unavailable", async () => {
    let callCount = 0;
    const okSoapResponse = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body>
        <esito>
          <pdf>${Buffer.from("fake-pdf").toString("base64")}</pdf>
        </esito>
      </soapenv:Body>
    </soapenv:Envelope>`;

    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 503,
          text: async () => "Service Unavailable",
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => okSoapResponse,
      };
    }) as unknown as typeof fetch;

    const client = new SistemaTsClient({ ...mockConfig, maxRetries: 2, retryBaseDelayMs: 5 });
    const res = await client.scaricaRicevutaPdf("PROT_503_RETRY");

    expect(callCount).toBe(2);
    expect(res.success).toBe(true);
    expect(res.pdfBuffer).toBeDefined();
  });

  it("non esegue retry su SOAP Fault applicativo (HTTP 500 con faultstring)", async () => {
    let callCount = 0;
    const soapFaultResponse = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body>
        <soapenv:Fault>
          <faultcode>soapenv:Server</faultcode>
          <faultstring>Credenziali non valide o utente bloccato</faultstring>
        </soapenv:Fault>
      </soapenv:Body>
    </soapenv:Envelope>`;

    globalThis.fetch = vi.fn(async () => {
      callCount++;
      return {
        ok: false,
        status: 500,
        text: async () => soapFaultResponse,
      };
    }) as unknown as typeof fetch;

    const client = new SistemaTsClient({ ...mockConfig, maxRetries: 2, retryBaseDelayMs: 5 });
    const res = await client.inviaFile(Buffer.from("dummy-zip"), "test.zip");

    // CRITICO: un errore applicativo non deve essere ritentato!
    expect(callCount).toBe(1);
    expect(res.success).toBe(false);
    expect(res.errorMessage).toContain("Credenziali non valide o utente bloccato");
  });

  it("si arrende e restituisce errore formattato se i tentativi massimi vengono esauriti", async () => {
    let callCount = 0;

    globalThis.fetch = vi.fn(async () => {
      callCount++;
      throw new TypeError("fetch failed: connect ECONNREFUSED 127.0.0.1:443");
    }) as unknown as typeof fetch;

    const client = new SistemaTsClient({ ...mockConfig, maxRetries: 2, retryBaseDelayMs: 5 });
    const res = await client.inviaFile(Buffer.from("dummy-zip"), "test.zip");

    // 1 tentativo iniziale + 2 retry = 3 chiamate totali
    expect(callCount).toBe(3);
    expect(res.success).toBe(false);
    expect(res.errorMessage).toContain("ECONNREFUSED");
    // Connessione mai stabilita: il file certamente non è arrivato a Sogei.
    expect(res.esitoIncerto).toBe(false);
  });

  it("rispetta maxRetries = 0 disabilitando i tentativi successivi", async () => {
    let callCount = 0;

    globalThis.fetch = vi.fn(async () => {
      callCount++;
      throw new TypeError("fetch failed: Connection reset by peer");
    }) as unknown as typeof fetch;

    const client = new SistemaTsClient({ ...mockConfig, maxRetries: 0 });
    const res = await client.inviaFile(Buffer.from("dummy-zip"), "test.zip");

    expect(callCount).toBe(1);
    expect(res.success).toBe(false);
  });
});

describe("SistemaTsClient — inviaFile non ritenta invii ambigui (CR-01)", () => {
  const originalFetch = globalThis.fetch;
  const okInvioResponse = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body><esito><protocollo>PROT_OK</protocollo></esito></soapenv:Body>
  </soapenv:Envelope>`;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function newClient() {
    return new SistemaTsClient({ ...mockConfig, maxRetries: 2, retryBaseDelayMs: 1 });
  }

  it.each([
    [
      "TimeoutError",
      () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }),
    ],
    ["ECONNRESET", () => new TypeError("fetch failed", { cause: { code: "ECONNRESET" } })],
    ["fetch failed senza causa", () => new TypeError("fetch failed")],
  ])("%s: una sola chiamata e esitoIncerto = true", async (_label, makeError) => {
    const fetchMock = vi.fn(async () => {
      throw makeError();
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await newClient().inviaFile(Buffer.from("zip"), "test.zip");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(false);
    expect(res.esitoIncerto).toBe(true);
  });

  it.each([502, 504])("HTTP %i: una sola chiamata e esitoIncerto = true", async (status) => {
    const fetchMock = vi.fn(async () => ({ ok: false, status, text: async () => "Gateway" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await newClient().inviaFile(Buffer.from("zip"), "test.zip");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(status);
    expect(res.esitoIncerto).toBe(true);
  });

  it("HTTP 503 (rifiuto esplicito) viene ritentato", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      return callCount === 1
        ? { ok: false, status: 503, text: async () => "Service Unavailable" }
        : { ok: true, status: 200, text: async () => okInvioResponse };
    }) as unknown as typeof fetch;

    const res = await newClient().inviaFile(Buffer.from("zip"), "test.zip");

    expect(callCount).toBe(2);
    expect(res.success).toBe(true);
    expect(res.protocollo).toBe("PROT_OK");
  });

  it("le operazioni di lettura continuano a ritentare su ECONNRESET", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
      }
      return {
        ok: true,
        status: 200,
        text: async () => "<esito><stato>2</stato></esito>",
      };
    }) as unknown as typeof fetch;

    const res = await newClient().interrogaEsito("PROT_X");

    expect(callCount).toBe(2);
    expect(res.success).toBe(true);
  });
});

describe("SistemaTsClient — durata massima di inviaFile (CR-11)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("la durata massima di inviaFile resta sotto la soglia dei lock orfani", () => {
    expect(MAX_DURATA_INVIO_MS).toBeLessThan(STALE_LOCK_MINUTES * 60_000);
  });

  it("non avvia un nuovo tentativo se non c'è più tempo per un tentativo intero", async () => {
    // Orologio simulato: ogni chiamata a Sogei "dura" 40 ms e risponde 503.
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      now += 40;
      return { ok: false, status: 503, text: async () => "Service Unavailable" };
    }) as unknown as typeof fetch;

    const client = new SistemaTsClient({
      ...mockConfig,
      maxRetries: 5,
      retryBaseDelayMs: 0,
      timeoutMs: 50,
      maxDurataInvioMs: 100,
    });
    const res = await client.inviaFile(Buffer.from("dummy-zip"), "test.zip");

    // Tentativo 1 finisce a 40 ms: 40 + 50 <= 100, si ritenta.
    // Tentativo 2 finisce a 80 ms: 80 + 50 > 100, ci si ferma.
    expect(callCount).toBe(2);
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(503);
    // L'ultimo errore era "sicuro" (503): nessun esito incerto.
    expect(res.esitoIncerto).toBe(false);
  });

  it("limita il timeout del singolo tentativo alla durata massima", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    })) as unknown as typeof fetch;

    const client = new SistemaTsClient({
      ...mockConfig,
      maxRetries: 0,
      timeoutMs: 600_000,
      maxDurataInvioMs: 1_000,
    });
    await client.inviaFile(Buffer.from("dummy-zip"), "test.zip");

    expect(timeoutSpy).toHaveBeenCalledWith(1_000);
  });
});

describe("isSafeToRetrySubmission", () => {
  it.each([
    ["429", new RetryableHttpError(429, ""), true],
    ["503", new RetryableHttpError(503, ""), true],
    ["502", new RetryableHttpError(502, ""), false],
    ["504", new RetryableHttpError(504, ""), false],
    ["code ECONNREFUSED", Object.assign(new Error("x"), { code: "ECONNREFUSED" }), true],
    ["messaggio ENOTFOUND", new Error("getaddrinfo ENOTFOUND host"), true],
    [
      "causa annidata UND_ERR_CONNECT_TIMEOUT",
      new TypeError("fetch failed", { cause: new Error("x", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }) }),
      true,
    ],
    ["ECONNRESET", new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }), false],
    ["TimeoutError", Object.assign(new Error("timeout"), { name: "TimeoutError" }), false],
    ["non-Error", "boom", false],
  ])("%s → %s", (_label, error, expected) => {
    expect(isSafeToRetrySubmission(error)).toBe(expected);
  });
});

describe("SistemaTsClient — XML Parsing Robustness (ERR-01)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("inviaFile parsa correttamente codiceEsito '000' (stringa con zeri) e decodifica entità XML", async () => {
    const soapResponse = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:inv="http://ejb.invioTelematicoSS730p.sanita.finanze.it/">
      <soapenv:Body>
        <inv:inviaFileMtomResponse>
          <protocollo>00123456789</protocollo>
          <esitoChiamata>000</esitoChiamata>
          <codiceEsito>000</codiceEsito>
          <descrizioneEsito>Documento ricevuto &amp; preso in carico</descrizioneEsito>
        </inv:inviaFileMtomResponse>
      </soapenv:Body>
    </soapenv:Envelope>`;

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => soapResponse,
    })) as unknown as typeof fetch;

    const client = new SistemaTsClient(mockConfig);
    const res = await client.inviaFile(Buffer.from("dummy-zip"), "test.zip");

    expect(res.success).toBe(true);
    expect(res.protocollo).toBe("00123456789");
    expect(res.codiceEsito).toBe("000");
    expect(res.descrizioneEsito).toBe("Documento ricevuto & preso in carico");
  });

  it("interrogaEsito gestisce risposte con tag auto-chiusi e contatori multipli", async () => {
    const soapResponse = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body>
        <esito>
          <stato>2</stato>
          <codiceEsito>00</codiceEsito>
          <descrizione>Elaborazione completata &lt;OK&gt;</descrizione>
          <nInviati>10</nInviati>
          <nAccolti>8</nAccolti>
          <nErrori>2</nErrori>
          <nWarnings>1</nWarnings>
          <dettaglioErrori />
        </esito>
      </soapenv:Body>
    </soapenv:Envelope>`;

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => soapResponse,
    })) as unknown as typeof fetch;

    const client = new SistemaTsClient(mockConfig);
    const res = await client.interrogaEsito("00123456789");

    expect(res.success).toBe(true);
    expect(res.statoElaborazione).toBe("2");
    expect(res.codiceEsito).toBe("00");
    expect(res.descrizioneEsito).toBe("Elaborazione completata <OK>");
    expect(res.numDocumentiRicevuti).toBe(10);
    expect(res.numDocumentiAccolti).toBe(8);
    expect(res.numDocumentiScartati).toBe(2);
    expect(res.numDocumentiWarnings).toBe(1);
  });

  it("scaricaDettaglioErrori gestisce codice WS11 (nessun errore) senza tentare parse CSV", async () => {
    const soapResponse = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body>
        <DettaglioErroriResponse>
          <codice>WS11</codice>
          <descrizione>Non sono presenti errori</descrizione>
          <csv />
        </DettaglioErroriResponse>
      </soapenv:Body>
    </soapenv:Envelope>`;

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => soapResponse,
    })) as unknown as typeof fetch;

    const client = new SistemaTsClient(mockConfig);
    const res = await client.scaricaDettaglioErrori("00123456789");

    expect(res.success).toBe(true);
    expect(res.message).toBe("Non sono presenti errori o segnalazioni per questa trasmissione.");
    expect(res.rawCsv).toBeUndefined();
  });
});

describe("SistemaTsClient — risposta di invio non interpretabile (P008)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function rispondeCon(status: number, body: string) {
    globalThis.fetch = vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    })) as unknown as typeof fetch;
  }

  it("una risposta 200 illeggibile è un esito incerto, non un rifiuto", async () => {
    rispondeCon(200, "<soapenv:Envelope><soapenv:Body><inv:inviaFileMtomRespo");

    const res = await new SistemaTsClient(mockConfig).inviaFile(Buffer.from("zip"), "t.zip");

    expect(res.success).toBe(false);
    expect(res.esitoIncerto).toBe(true);
  });

  it("un codice esito di errore senza protocollo resta un rifiuto certo", async () => {
    rispondeCon(
      200,
      "<soapenv:Envelope><soapenv:Body><r><codiceEsito>E01</codiceEsito><descrizioneEsito>File non valido</descrizioneEsito></r></soapenv:Body></soapenv:Envelope>"
    );

    const res = await new SistemaTsClient(mockConfig).inviaFile(Buffer.from("zip"), "t.zip");

    expect(res.success).toBe(false);
    expect(res.esitoIncerto).toBeFalsy();
    expect(res.errorMessage).toBe("File non valido");
  });

  it("una risposta 4xx illeggibile resta un rifiuto certo (es. credenziali errate)", async () => {
    rispondeCon(401, "Unauthorized");

    const res = await new SistemaTsClient(mockConfig).inviaFile(Buffer.from("zip"), "t.zip");

    expect(res.success).toBe(false);
    expect(res.esitoIncerto).toBeFalsy();
  });
});

describe("SistemaTsClient — endpoint di test riconosciuto dall'hostname (P030)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  function inviaA(endpointInvio: string) {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "<r><protocollo>P1</protocollo><codiceEsito>000</codiceEsito></r>",
    })) as unknown as typeof fetch;
    return new SistemaTsClient({ ...mockConfig, endpointInvio }).inviaFile(Buffer.from("zip"), "t.zip");
  }

  it.each([
    "https://invioSS730p.sanita.finanze.it/latest/InvioTelematicoSS730pMtomPort",
    "https://invioSS730p.sanita.finanze.it/InvioTelematicoSS730pMtomWeb?mock=1",
    "non-una-url-test",
  ])("blocca un endpoint di produzione anche con 'test' o 'mock' fuori dall'hostname: %s", async (url) => {
    vi.stubEnv("SISTEMATS_ALLOW_PRODUCTION", "false");
    await expect(inviaA(url)).rejects.toThrow(/\[BLOCCO DI SICUREZZA\]/);
  });

  it.each([
    "https://invioSS730pTest.sanita.finanze.it/InvioTelematicoSS730pMtomWeb/InvioTelematicoSS730pMtomPort",
    "http://localhost:4000/invio",
    "http://127.0.0.1:4000/invio",
  ])("consente gli endpoint di test: %s", async (url) => {
    vi.stubEnv("SISTEMATS_ALLOW_PRODUCTION", "false");
    await expect(inviaA(url)).resolves.toMatchObject({ protocollo: "P1" });
  });
});
