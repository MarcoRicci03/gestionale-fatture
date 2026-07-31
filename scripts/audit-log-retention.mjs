// Elimina periodicamente le righe di audit_logs più vecchie della retention
// configurata (SEC-12, vedi PIANO_FIX_AUDIT_LOG_RETENTION.md). Pensato per
// girare come entrypoint del container "audit-log-retention" in
// docker-compose.prod.yml.
//
// ESM puro come prisma/seed.mjs, per lo stesso motivo: deve poter girare
// nell'immagine di produzione dopo `npm prune --omit=dev`, che rimuove
// tsx/typescript — importa solo @prisma/client, @prisma/adapter-pg e pg
// (dipendenze di produzione), non lib/prisma.ts (TypeScript).
//
// Uso:
//   node scripts/audit-log-retention.mjs

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { msUntilNextRun } from "./lib/retention-schedule.mjs";

const RETENTION_MONTHS = Number(process.env.AUDIT_LOG_RETENTION_MONTHS ?? 12);
const TARGET_WEEKDAY = Number(process.env.AUDIT_LOG_RETENTION_WEEKDAY ?? 0); // 0 = domenica
const TARGET_HOUR = Number(process.env.AUDIT_LOG_RETENTION_HOUR ?? 3);
const HEALTHCHECK_PING_URL = process.env.AUDIT_LOG_RETENTION_HEALTHCHECK_PING_URL;

// Notifica esterna di esito (DEP-06), modello "dead man's switch": senza
// AUDIT_LOG_RETENTION_HEALTHCHECK_PING_URL configurata resta inerte. Finora
// un fallimento persistente produceva solo una riga di log in un container
// che nessuno apre. Un ping MANCANTE (non solo un ping di fallimento)
// allarma anche nel caso peggiore: il container non è più partito affatto.
// Convenzione Healthchecks.io: GET sull'URL base segnala successo, /fail
// segnala fallimento esplicito. `fetch` è globale da Node 18+, nessuna
// dipendenza aggiuntiva da tirare dentro l'immagine di produzione.
async function pingHealthcheck(ok) {
  if (!HEALTHCHECK_PING_URL) return;
  const url = ok ? HEALTHCHECK_PING_URL : `${HEALTHCHECK_PING_URL}/fail`;
  try {
    await fetch(url);
  } catch (error) {
    console.error("[audit-log-retention] ping al servizio di monitoraggio fallito:", error);
  }
}

// Connessione aperta e richiusa ad ogni esecuzione, non tenuta viva per una
// settimana intera tra un'iterazione e l'altra: una connessione Postgres
// tenuta aperta per giorni rischia di essere interrotta da timeout di
// rete/OS nel frattempo, causando un fallimento silenzioso al risveglio.
// Stesso spirito di scripts/backup-db.sh, che rilancia pg_dump da zero ad
// ogni iterazione invece di tenere un processo aperto.
async function purgeOnce() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

    const { count } = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    console.log(
      `[audit-log-retention] ${new Date().toISOString()} eliminate ${count} righe più vecchie di ${cutoff.toISOString()}`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[audit-log-retention] DATABASE_URL non configurato nelle variabili d'ambiente.");
    process.exitCode = 1;
    return;
  }

  while (true) {
    const waitMs = msUntilNextRun(new Date(), TARGET_WEEKDAY, TARGET_HOUR);
    console.log(
      `[audit-log-retention] prossima esecuzione tra ${Math.round(waitMs / 60000)} minuti`
    );
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Un fallimento (es. DB temporaneamente irraggiungibile al risveglio)
    // non deve terminare il loop: verrà ritentato alla prossima occorrenza
    // settimanale.
    await purgeOnce()
      .then(() => pingHealthcheck(true))
      .catch(async (error) => {
        console.error("[audit-log-retention] errore durante la pulizia:", error);
        await pingHealthcheck(false);
      });
  }
}

main();
