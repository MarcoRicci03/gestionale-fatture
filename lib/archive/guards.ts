// Regole pure per l'archiviazione/hard-delete di Pagante e Paziente,
// condivise tra le server action (lib/actions/payers.ts,
// lib/actions/patients.ts) e lo script di verifica
// scripts/verify-archive-guards.ts.

export type FiscalFields = { cf: string | null; piva: string | null };

export type RestoreConflict = { field: "cf" | "piva"; conflictingId: number };

// Gli indici unique parziali su paganti(cf)/paganti(piva) valgono solo tra i
// paganti attivi (archiviato = false), quindi activePayers deve contenere
// SOLO paganti attivi: un pagante archiviato con lo stesso cf non è un
// conflitto.
export function findRestoreConflict(
  target: FiscalFields,
  activePayers: (FiscalFields & { id: number })[]
): RestoreConflict | null {
  if (target.cf) {
    const conflict = activePayers.find((p) => p.cf === target.cf);
    if (conflict) return { field: "cf", conflictingId: conflict.id };
  }
  if (target.piva) {
    const conflict = activePayers.find((p) => p.piva === target.piva);
    if (conflict) return { field: "piva", conflictingId: conflict.id };
  }
  return null;
}

// Un pagante può essere eliminato definitivamente solo se non ha fatture
// collegate (dirette o dei suoi pazienti) e se non ha pazienti ancora non
// archiviati: il cascade DB su pazienti.id_Pagante (ON DELETE CASCADE) non
// deve mai far sparire un record che l'utente non ha esplicitamente
// archiviato.
export function canHardDeletePayer(counts: {
  fatture: number;
  pazientiNonArchiviati: number;
}): boolean {
  return counts.fatture === 0 && counts.pazientiNonArchiviati === 0;
}

export function canHardDeletePatient(counts: { fatture: number }): boolean {
  return counts.fatture === 0;
}
