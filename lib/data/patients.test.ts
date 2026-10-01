import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// P028: getArchivedPatients unisce la pagina dei pazienti archiviati alle
// statistiche delle loro fatture, sempre filtrate per utente.

vi.mock("@/lib/auth/session", () => ({ requireUserId: vi.fn(async () => 6) }));

const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockGroupBy = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    paziente: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      count: (...a: unknown[]) => mockCount(...a),
    },
    pagamento: { groupBy: (...a: unknown[]) => mockGroupBy(...a) },
  },
}));

const { getArchivedPatients } = await import("./patients");

const paziente = (id: number) => ({
  id,
  nome: "P",
  cognome: `C${id}`,
  archiviato: true,
  pagante: { id: 1, nome: "A", cognome: "B", archiviato: true },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getArchivedPatients", () => {
  it("aggiunge conteggio, totale e anni delle fatture per paziente, filtrando per utente", async () => {
    mockFindMany.mockResolvedValueOnce([paziente(1), paziente(2)]);
    mockCount.mockResolvedValueOnce(2);
    mockGroupBy.mockResolvedValueOnce([
      {
        id_Paziente: 1,
        _count: { _all: 3 },
        _sum: { prezzo_totale: new Prisma.Decimal("150.50") },
        _min: { anno: 2024 },
        _max: { anno: 2026 },
      },
    ]);

    const res = await getArchivedPatients("", 1);

    expect(mockGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_Utente: 6, id_Paziente: { in: [1, 2] } } })
    );
    expect(res.totalCount).toBe(2);
    expect(res.patients[0]).toMatchObject({
      fattureCount: 3,
      fattureTotale: 150.5,
      fatturaAnnoMin: 2024,
      fatturaAnnoMax: 2026,
    });
    expect(res.patients[1]).toMatchObject({
      fattureCount: 0,
      fattureTotale: 0,
      fatturaAnnoMin: null,
      fatturaAnnoMax: null,
    });
  });

  it("senza pazienti archiviati non interroga le fatture", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    const res = await getArchivedPatients("", 1);

    expect(res).toEqual({ patients: [], totalCount: 0, page: 1 });
    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it("oltre l'ultima pagina rilegge la pagina valida", async () => {
    mockFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([paziente(1)]);
    mockCount.mockResolvedValueOnce(1);
    mockGroupBy.mockResolvedValueOnce([]);

    const res = await getArchivedPatients("", 5);

    expect(res.page).toBe(1);
    expect(res.patients).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });
});
