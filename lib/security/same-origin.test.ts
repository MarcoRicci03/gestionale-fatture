import { describe, it, expect } from "vitest";
import { isSameOriginRequest } from "./same-origin";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://ignored.example/api/invoices/export", {
    method: "POST",
    headers,
  });
}

describe("isSameOriginRequest", () => {
  it("true quando Origin e Host coincidono", () => {
    const request = makeRequest({
      origin: "https://gestionale.marcor.it",
      host: "gestionale.marcor.it",
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("false quando Origin e Host non coincidono (richiesta cross-site)", () => {
    const request = makeRequest({
      origin: "https://evil.example",
      host: "gestionale.marcor.it",
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("false quando manca l'header Origin", () => {
    const request = makeRequest({ host: "gestionale.marcor.it" });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("false quando manca sia Host sia X-Forwarded-Host", () => {
    const request = new Request("http://ignored.example/api/invoices/export", {
      method: "POST",
      headers: { origin: "https://gestionale.marcor.it" },
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("SEC-06: ignora X-Forwarded-Host e blocca lo spoofing CSRF se trustedProxy è disabilitato", () => {
    // Un attaccante su evil.example tenta di forzare X-Forwarded-Host per far combaciare
    // l'host con il proprio Origin. Senza un proxy fidato, l'header X-Forwarded-Host va ignorato.
    const request = makeRequest({
      origin: "https://evil.example",
      host: "gestionale.marcor.it",
      "x-forwarded-host": "evil.example",
    });
    // Con opzione esplicita trustedProxy: false
    expect(isSameOriginRequest(request, { trustedProxy: false })).toBe(false);
    // Con default applicativo (process.env.TRUSTED_PROXY non impostato o false)
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("SEC-06: accetta X-Forwarded-Host su Host quando trustedProxy è abilitato", () => {
    const request = makeRequest({
      origin: "https://gestionale.marcor.it",
      host: "192.168.0.160:3000",
      "x-forwarded-host": "gestionale.marcor.it",
    });
    expect(isSameOriginRequest(request, { trustedProxy: true })).toBe(true);
  });

  it("SEC-06: estrae il primo host in caso di catene di proxy multiple separate da virgola", () => {
    const request = makeRequest({
      origin: "https://gestionale.marcor.it",
      host: "192.168.0.160:3000",
      "x-forwarded-host": "gestionale.marcor.it, internal-proxy.lan",
    });
    expect(isSameOriginRequest(request, { trustedProxy: true })).toBe(true);
  });

  it("SEC-06: normalizza porte standard (:443, :80) e case-insensitivity", () => {
    const httpsWithPort = makeRequest({
      origin: "https://gestionale.marcor.it",
      host: "GESTIONALE.marcor.it:443",
    });
    expect(isSameOriginRequest(httpsWithPort)).toBe(true);

    const httpWithPort = makeRequest({
      origin: "http://gestionale.marcor.it",
      host: "gestionale.marcor.it:80",
    });
    expect(isSameOriginRequest(httpWithPort)).toBe(true);
  });

  it("false su un Origin sintatticamente non valido", () => {
    const request = makeRequest({
      origin: "not-a-valid-url",
      host: "gestionale.marcor.it",
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });
});
