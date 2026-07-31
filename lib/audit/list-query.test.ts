import { describe, it, expect } from "vitest";
import { buildAuditLogWhere } from "./list-query";
import { EMPTY_AUDIT_LOG_FILTERS, type AuditLogFilters } from "./list-query";

describe("buildAuditLogWhere", () => {
  it("senza filtri: where vuoto", () => {
    expect(buildAuditLogWhere(EMPTY_AUDIT_LOG_FILTERS)).toEqual({});
  });

  it("intervallo di date completo: gte a inizio giornata, lte a fine giornata", () => {
    const filters: AuditLogFilters = {
      ...EMPTY_AUDIT_LOG_FILTERS,
      dataDa: "2026-06-15",
      dataA: "2026-06-16",
    };
    expect(buildAuditLogWhere(filters)).toEqual({
      AND: [
        {
          createdAt: {
            gte: new Date(2026, 5, 15, 0, 0, 0, 0),
            lte: new Date(2026, 5, 16, 23, 59, 59, 999),
          },
        },
      ],
    });
  });

  it("solo dataDa: nessuna chiave lte", () => {
    const filters: AuditLogFilters = { ...EMPTY_AUDIT_LOG_FILTERS, dataDa: "2026-06-15" };
    const where = buildAuditLogWhere(filters);
    const clause = (where.AND as { createdAt: Record<string, unknown> }[])[0].createdAt;
    expect(clause).toEqual({ gte: new Date(2026, 5, 15, 0, 0, 0, 0) });
  });

  it("utente: match esatto sulla relazione (is, non contains)", () => {
    const filters: AuditLogFilters = { ...EMPTY_AUDIT_LOG_FILTERS, utente: "luigi" };
    expect(buildAuditLogWhere(filters)).toEqual({
      AND: [{ utente: { is: { username: "luigi" } } }],
    });
  });

  it("azione: match esatto", () => {
    const filters: AuditLogFilters = {
      ...EMPTY_AUDIT_LOG_FILTERS,
      azione: "invoice.create",
    };
    expect(buildAuditLogWhere(filters)).toEqual({
      AND: [{ azione: "invoice.create" }],
    });
  });

  it("ricerca non numerica: OR contains insensitive su entita e ip, niente entitaId", () => {
    const filters: AuditLogFilters = { ...EMPTY_AUDIT_LOG_FILTERS, ricerca: "Pagamento" };
    expect(buildAuditLogWhere(filters)).toEqual({
      AND: [
        {
          OR: [
            { entita: { contains: "Pagamento", mode: "insensitive" } },
            { ip: { contains: "Pagamento", mode: "insensitive" } },
          ],
        },
      ],
    });
  });

  it("ricerca numerica: aggiunge match ESATTO su entitaId (non substring, a differenza del filtro client precedente)", () => {
    const filters: AuditLogFilters = { ...EMPTY_AUDIT_LOG_FILTERS, ricerca: "42" };
    expect(buildAuditLogWhere(filters)).toEqual({
      AND: [
        {
          OR: [
            { entita: { contains: "42", mode: "insensitive" } },
            { ip: { contains: "42", mode: "insensitive" } },
            { entitaId: 42 },
          ],
        },
      ],
    });
  });

  it("combina più filtri in AND", () => {
    const filters: AuditLogFilters = {
      ...EMPTY_AUDIT_LOG_FILTERS,
      azione: "invoice.create",
      utente: "mario",
    };
    expect(buildAuditLogWhere(filters)).toEqual({
      AND: [
        { utente: { is: { username: "mario" } } },
        { azione: "invoice.create" },
      ],
    });
  });
});
