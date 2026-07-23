import type { Pagante, Paziente } from "@prisma/client";

// Snapshot immutabile dei dati anagrafici di pagante/paziente al momento
// dell'emissione/ultima modifica della fattura — stesso principio di
// Pagamento.pdfLayoutSnapshot, applicato ai dati del cliente invece che al
// template grafico. Contiene solo i campi effettivamente mostrati su
// PDF/UI/export (vedi lib/pdf/placeholders.ts, invoices-manager.tsx) — non
// un dump 1:1 di Pagante/Paziente (niente id, id_Utente, archiviato: sono
// stato del record vivo, non dati del documento).
export type SnapshotAnagrafica = {
  pagante: {
    nome: string;
    cognome: string;
    via: string;
    citta: string;
    cap: string;
    cf: string | null;
    piva: string | null;
  };
  paziente: {
    nome: string;
    cognome: string;
  };
};

export function isSnapshotAnagrafica(
  value: unknown
): value is SnapshotAnagrafica {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.pagante !== "object" || v.pagante === null) return false;
  if (typeof v.paziente !== "object" || v.paziente === null) return false;
  const p = v.pagante as Record<string, unknown>;
  const z = v.paziente as Record<string, unknown>;
  return (
    typeof p.nome === "string" &&
    typeof p.cognome === "string" &&
    typeof p.via === "string" &&
    typeof p.citta === "string" &&
    typeof p.cap === "string" &&
    (p.cf === null || typeof p.cf === "string") &&
    (p.piva === null || typeof p.piva === "string") &&
    typeof z.nome === "string" &&
    typeof z.cognome === "string"
  );
}

export function buildSnapshotAnagrafica(
  pagante: Pagante,
  paziente: Paziente
): SnapshotAnagrafica {
  return {
    pagante: {
      nome: pagante.nome,
      cognome: pagante.cognome,
      via: pagante.via,
      citta: pagante.citta,
      cap: pagante.cap,
      cf: pagante.cf,
      piva: pagante.piva,
    },
    paziente: {
      nome: paziente.nome,
      cognome: paziente.cognome,
    },
  };
}

export function resolveAnagrafica(invoice: {
  snapshotAnagrafica: unknown;
  pagante: Pagante;
  paziente: Paziente;
}): SnapshotAnagrafica {
  if (isSnapshotAnagrafica(invoice.snapshotAnagrafica)) {
    return invoice.snapshotAnagrafica;
  }
  // Fallback per fatture create prima di questo fix: nessuno snapshot,
  // si ripiega sulle relazioni live (comportamento identico a oggi).
  return buildSnapshotAnagrafica(invoice.pagante, invoice.paziente);
}
