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

  it("preferisce X-Forwarded-Host su Host, dietro un reverse proxy", () => {
    const request = makeRequest({
      origin: "https://gestionale.marcor.it",
      host: "192.168.0.160:3000",
      "x-forwarded-host": "gestionale.marcor.it",
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("false su un Origin sintatticamente non valido", () => {
    const request = makeRequest({
      origin: "not-a-valid-url",
      host: "gestionale.marcor.it",
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });
});
