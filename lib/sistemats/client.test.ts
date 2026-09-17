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
