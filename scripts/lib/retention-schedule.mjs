// JS puro (non .ts): scripts/audit-log-retention.mjs lo importa a runtime
// nell'immagine di produzione, dove npm prune --omit=dev ha già rimosso
// tsx/typescript (stesso motivo per cui prisma/seed.mjs è ESM puro).
//
// Quanti millisecondi mancano alla prossima occorrenza di
// {targetWeekday, targetHour:00:00} in ora LOCALE del processo. Il container
// di produzione fissa TZ=Europe/Rome (Dockerfile), quindi getDay()/getHours()
// restituiscono già l'ora italiana, DST inclusa — nessuna libreria di fusi
// orari necessaria.
export function msUntilNextRun(now, targetWeekday, targetHour) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, 0, 0, 0);
  const daysUntil = (targetWeekday - now.getDay() + 7) % 7;
  next.setDate(next.getDate() + daysUntil);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
  }

  return next.getTime() - now.getTime();
}

// Calcola la data di cutoff per la retention sottraendo (retentionMonths * 30) giorni.
// Evita il date-drift di setMonth() sui giorni 29, 30 e 31 (ERR-03).
export function calculateCutoffDate(now, retentionMonths) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - retentionMonths * 30);
  return cutoff;
}
