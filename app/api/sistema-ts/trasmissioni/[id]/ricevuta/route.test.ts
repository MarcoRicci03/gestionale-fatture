import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUserIdOrNull = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getUserIdOrNull: () => mockGetUserIdOrNull(),
}));

const mockTrasmissioneFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trasmissioneTs: {
      findFirst: (...args: unknown[]) => mockTrasmissioneFindFirst(...args),
    },
  },
}));

import { GET } from "./route";

describe("GET /api/sistema-ts/trasmissioni/[id]/ricevuta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserIdOrNull.mockResolvedValue(1);
  });

  it("restituisce 401 se l'utente non è autenticato", async () => {
    mockGetUserIdOrNull.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Non autenticato");
  });

  it("restituisce 400 se l'id non è un numero intero positivo valido", async () => {
    const invalidIds = ["abc", "-1", "0", "1.5", "NaN", "Infinity", "99999999999999999"];

    for (const id of invalidIds) {
      const res = await GET(new Request("http://localhost/api/test"), {
        params: Promise.resolve({ id }),
      });
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("ID trasmissione non valido");
    }
  });

  it("restituisce 404 se la trasmissione non esiste o appartiene a un altro utente", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "99" }),
    });

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Ricevuta non trovata");
    expect(mockTrasmissioneFindFirst).toHaveBeenCalledWith({
      where: { id: 99, id_Utente: 1 },
      select: { pdfRicevuta: true, protocollo: true },
    });
  });

  it("restituisce 404 se la trasmissione esiste ma non ha il PDF della ricevuta memorizzato", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 42,
      protocollo: "PROT_42",
      pdfRicevuta: null,
    });

    const res = await GET(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Ricevuta non trovata");
  });

  it("restituisce 200 con streaming PDF binario, Content-Disposition attachment e Cache-Control no-store", async () => {
    const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 42,
      protocollo: "PROT_2026_XYZ",
      pdfRicevuta: fakePdfBytes,
    });

    const res = await GET(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="ricevuta_PROT_2026_XYZ.pdf"');
    expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");

    const arrayBuffer = await res.arrayBuffer();
    expect(new Uint8Array(arrayBuffer)).toEqual(fakePdfBytes);
  });

  it("sanitizza caratteri non sicuri nel protocollo per il filename", async () => {
    const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 43,
      protocollo: "PROT/2026:01",
      pdfRicevuta: fakePdfBytes,
    });

    const res = await GET(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "43" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="ricevuta_PROT_2026_01.pdf"');
  });

  it("usa l'id come fallback se il protocollo è vuoto o null", async () => {
    const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 44,
      protocollo: null,
      pdfRicevuta: fakePdfBytes,
    });

    const res = await GET(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "44" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="ricevuta_44.pdf"');
  });
});
