import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const mockQueryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import {
  GET,
  isInternalHealthcheck,
  healthCheckLimiter,
  INTERNAL_HEALTHCHECK_HEADER,
} from "./route";

describe("isInternalHealthcheck", () => {
  it("riconosce come interno un healthcheck da loopback con header dedicato", () => {
    const headers = new Headers({
      host: "127.0.0.1:3000",
      [INTERNAL_HEALTHCHECK_HEADER]: "1",
    });
    expect(isInternalHealthcheck(headers)).toBe(true);

    const localhostHeaders = new Headers({
      host: "localhost:3000",
      [INTERNAL_HEALTHCHECK_HEADER]: "1",
    });
    expect(isInternalHealthcheck(localhostHeaders)).toBe(true);

    const ipv6Headers = new Headers({
      host: "[::1]:3000",
      [INTERNAL_HEALTHCHECK_HEADER]: "1",
    });
    expect(isInternalHealthcheck(ipv6Headers)).toBe(true);
  });

  it("rifiuta richieste senza l'header interno X-Healthcheck-Internal: 1", () => {
    const noHeader = new Headers({ host: "127.0.0.1:3000" });
    expect(isInternalHealthcheck(noHeader)).toBe(false);

    const wrongHeaderValue = new Headers({
      host: "127.0.0.1:3000",
      [INTERNAL_HEALTHCHECK_HEADER]: "true",
    });
    expect(isInternalHealthcheck(wrongHeaderValue)).toBe(false);
  });

  it("rifiuta richieste con Host esterno anche se presentano l'header interno", () => {
    const externalHost = new Headers({
      host: "gestionale.example.com",
      [INTERNAL_HEALTHCHECK_HEADER]: "1",
    });
    expect(isInternalHealthcheck(externalHost)).toBe(false);

    const lanHost = new Headers({
      host: "192.168.1.50:3000",
      [INTERNAL_HEALTHCHECK_HEADER]: "1",
    });
    expect(isInternalHealthcheck(lanHost)).toBe(false);
  });

  it("rifiuta qualsiasi richiesta che contenga header di reverse proxy (spoofing prevention)", () => {
    // Tentativo di un client esterno di bypassare il rate limit inviando Host: 127.0.0.1
    // e X-Healthcheck-Internal: 1 attraverso un proxy (es. Cloudflare Tunnel o Nginx)
    const proxyHeaders: Record<string, string>[] = [
      { "cf-connecting-ip": "203.0.113.1" },
      { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
      { "x-real-ip": "203.0.113.1" },
      { "x-forwarded-host": "gestionale.example.com" },
    ];

    for (const pHeader of proxyHeaders) {
      const headers = new Headers({
        host: "127.0.0.1:3000",
        [INTERNAL_HEALTHCHECK_HEADER]: "1",
        ...pHeader,
      });
      expect(isInternalHealthcheck(headers)).toBe(false);
    }
  });
});

describe("GET /api/health handler & DoS Starvation Prevention", () => {
  beforeEach(() => {
    healthCheckLimiter.reset();
    mockQueryRaw.mockReset();
    mockQueryRaw.mockResolvedValue([{ 1: 1 }]);
  });

  it("risponde 200 OK con status: ok se il database è raggiungibile", async () => {
    const req = new Request("http://127.0.0.1:3000/api/health", {
      headers: {
        host: "127.0.0.1:3000",
        [INTERNAL_HEALTHCHECK_HEADER]: "1",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("risponde 503 con status: error se la query al database fallisce", async () => {
    mockQueryRaw.mockRejectedValue(new Error("Connection refused"));

    const req = new Request("http://127.0.0.1:3000/api/health", {
      headers: {
        host: "127.0.0.1:3000",
        [INTERNAL_HEALTHCHECK_HEADER]: "1",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: "error" });
  });

  it("applica il rate limiter (max 30 req/min) alle richieste pubbliche esterne", async () => {
    // 30 richieste esterne devono essere accettate
    for (let i = 0; i < 30; i++) {
      const externalReq = new Request("http://gestionale.example.com/api/health", {
        headers: { host: "gestionale.example.com" },
      });
      const res = await GET(externalReq);
      expect(res.status).toBe(200);
    }

    // La 31-esima richiesta esterna deve ricevere 429 Too Many Requests
    const blockedReq = new Request("http://gestionale.example.com/api/health", {
      headers: { host: "gestionale.example.com" },
    });
    const res = await GET(blockedReq);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
  });

  it("SEC-CRIT: l'healthcheck interno continua a ricevere 200 anche se il rate limit pubblico è saturato (no starvation)", async () => {
    // Un attaccante esterno satura completamente il bucket pubblico (30 richieste)
    for (let i = 0; i < 30; i++) {
      const externalReq = new Request("http://gestionale.example.com/api/health", {
        headers: { host: "gestionale.example.com" },
      });
      const res = await GET(externalReq);
      expect(res.status).toBe(200);
    }

    // Un'ulteriore richiesta esterna riceve 429
    const blockedReq = new Request("http://gestionale.example.com/api/health", {
      headers: { host: "gestionale.example.com" },
    });
    const blockedRes = await GET(blockedReq);
    expect(blockedRes.status).toBe(429);

    // L'healthcheck interno Docker (wget da 127.0.0.1 con header X-Healthcheck-Internal: 1)
    // NON viene bloccato e continua a ricevere 200 OK!
    const internalReq = new Request("http://127.0.0.1:3000/api/health", {
      headers: {
        host: "127.0.0.1:3000",
        [INTERNAL_HEALTHCHECK_HEADER]: "1",
      },
    });
    const internalRes = await GET(internalReq);
    expect(internalRes.status).toBe(200);
    const body = await internalRes.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("blocca tentativi di spoofing con 429 quando il bucket pubblico è esaurito", async () => {
    // Satura il rate limit pubblico
    for (let i = 0; i < 30; i++) {
      const externalReq = new Request("http://gestionale.example.com/api/health", {
        headers: { host: "gestionale.example.com" },
      });
      await GET(externalReq);
    }

    // Richiesta con header interno ma con proxy header (spoofing da internet)
    const spoofedReq = new Request("http://gestionale.example.com/api/health", {
      headers: {
        host: "127.0.0.1:3000",
        [INTERNAL_HEALTHCHECK_HEADER]: "1",
        "x-forwarded-for": "203.0.113.5",
      },
    });

    const res = await GET(spoofedReq);
    expect(res.status).toBe(429);
  });
});

describe("docker-compose.prod.yml healthcheck configuration", () => {
  it("include l'header X-Healthcheck-Internal: 1 nel comando wget di healthcheck", () => {
    const composeContent = readFileSync(
      join(__dirname, "../../../docker-compose.prod.yml"),
      "utf-8"
    );

    // Verifica che il comando healthcheck contenga sia l'endpoint health che l'header interno
    expect(composeContent).toMatch(
      /wget\s+.*--header=\\?"X-Healthcheck-Internal:\s*1\\?".*\/api\/health/
    );
  });
});
