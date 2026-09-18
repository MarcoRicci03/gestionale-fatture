import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { SistemaTsClient } from "./client";
import type { SistemaTsConfig } from "./types";

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

  it("esegue retry con successo dopo un errore temporaneo di rete (es. fetch failed)", async () => {
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
        throw new TypeError("fetch failed: ECONNRESET");
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
      throw new TypeError("fetch failed: Connection reset by peer");
    }) as unknown as typeof fetch;

    const client = new SistemaTsClient({ ...mockConfig, maxRetries: 2, retryBaseDelayMs: 5 });
    const res = await client.inviaFile(Buffer.from("dummy-zip"), "test.zip");

    // 1 tentativo iniziale + 2 retry = 3 chiamate totali
    expect(callCount).toBe(3);
    expect(res.success).toBe(false);
    expect(res.errorMessage).toContain("Connection reset by peer");
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
