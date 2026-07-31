// Correzione una tantum delle fatture importate dal vecchio gestionale.
//
// Il vecchio sistema sommava automaticamente 2€ di marca da bollo a
// prezzo_totale (e all'unico FatturaMese collegato — nel vecchio DB ogni
// fattura aveva un solo mese) quando l'importo superava SOGLIA_BOLLO, ma non
// tracciava mai il codice seriale del bollo (bolloCodice resta NULL su
// queste righe). Il bollo era realmente acquistato e apposto, solo il
// codice non è mai stato digitalizzato. Nel gestionale attuale
// prezzo_totale è invece sempre l'importo puro, e i 2€ vengono sommati solo
// in visualizzazione quando bolloCodice è valorizzato
// (lib/invoices/bollo-total.ts) — queste righe storiche sono quindi oggi
// strutturalmente incoerenti col resto dei dati.
//
// Questo script, per ogni fattura storica interessata: sottrae 2€ sia da
// prezzo_totale sia dall'unico FatturaMese.prezzo collegato (altrimenti una
// futura modifica della fattura tramite l'app, che ricalcola prezzo_totale
// come somma dei mesi, farebbe ricomparire l'inflazione), e imposta
// bolloCodice a un codice segnaposto distinto per fattura — non il vero
// seriale (mai tracciato, non recuperabile da qui), ma un valore che
// soddisfa il formato e l'unicità richiesti e resta riconoscibile come
// segnaposto (vedi scripts/lib/legacy-bollo-fix.mjs).
//
// Selezione delle righe: snapshotAnagrafica NULLO (valorizzato SEMPRE da
// createInvoice quando una fattura passa dall'app — una riga con questo
// campo nullo non può essere mai stata creata così, quindi è
// un'importazione diretta) + prezzo_totale sopra soglia + bolloCodice
// nullo. Senza il controllo su snapshotAnagrafica, una fattura NUOVA con
// bollo dovuto ma non ancora inserito (stato valido e previsto, vedi
// bolloMancante in components/invoices/invoice-form.tsx) avrebbe la stessa
// forma di una riga storica e verrebbe corrotta.
//
// Idempotente: una riga già corretta ha bolloCodice valorizzato, quindi non
// viene più selezionata da un rilancio successivo.
//
// ESM puro come prisma/seed.mjs/scripts/audit-log-retention.mjs: deve poter
// girare anche nell'immagine di produzione dopo npm prune --omit=dev.
//
// Uso (fare un backup prima di usare --apply, es. scripts/backup-db.sh o
// pg_dump manuale — tocca dati finanziari in modo difficile da annullare):
//   node scripts/fix-legacy-bollo-invoices.mjs           (dry-run, nessuna scrittura)
//   node scripts/fix-legacy-bollo-invoices.mjs --apply   (applica davvero le correzioni)

import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  isLegacyBolloCandidate,
  buildLegacyBolloPlaceholder,
} from "./lib/legacy-bollo-fix.mjs";

const IMPORTO_BOLLO = 2.0;
const APPLY = process.argv.includes("--apply");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "[fix-legacy-bollo] DATABASE_URL non configurato nelle variabili d'ambiente."
    );
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Filtro grezzo lato DB sui campi nulli: il confronto esatto sulla
    // soglia lo fa isLegacyBolloCandidate, unica fonte di verità condivisa
    // col test in scripts/lib/legacy-bollo-fix.test.ts.
    //
    // snapshotAnagrafica è Json?: Prisma non accetta il semplice `null` nel
    // filtro per le colonne JSON (a differenza di bolloCodice, uno String?
    // scalare) — serve il valore speciale Prisma.DbNull, che indica NULL nel
    // database (distinto da un valore JSON letterale `null`, che sarebbe
    // Prisma.JsonNull).
    const rows = await prisma.pagamento.findMany({
      where: {
        snapshotAnagrafica: { equals: Prisma.DbNull },
        bolloCodice: null,
      },
      include: { mesi: true },
      orderBy: [{ id_Utente: "asc" }, { id: "asc" }],
    });

    const toFix = [];
    const skippedMultiMese = [];

    for (const invoice of rows) {
      const candidate = isLegacyBolloCandidate({
        snapshotAnagrafica: invoice.snapshotAnagrafica,
        prezzoTotale: invoice.prezzo_totale.toNumber(),
        bolloCodice: invoice.bolloCodice,
      });
      if (!candidate) continue;

      if (invoice.mesi.length !== 1) {
        // Nel vecchio DB ogni fattura aveva un solo mese: più di uno qui è
        // un segnale che questa riga potrebbe non essere davvero
        // un'importazione storica. Va rivista a mano, non corretta alla
        // cieca.
        skippedMultiMese.push(invoice);
        continue;
      }

      toFix.push(invoice);
    }

    console.log(`[fix-legacy-bollo] righe candidate: ${toFix.length}`);

    if (skippedMultiMese.length > 0) {
      console.log(
        `[fix-legacy-bollo] righe SALTATE (più di un mese collegato, da rivedere a mano): ${skippedMultiMese.length}`
      );
      for (const invoice of skippedMultiMese) {
        console.log(
          `  - id=${invoice.id} utente=${invoice.id_Utente} fattura=${invoice.n_fattura}/${invoice.anno} mesi=${invoice.mesi.length}`
        );
      }
    }

    for (const invoice of toFix) {
      const mese = invoice.mesi[0];
      const nuovoTotale = invoice.prezzo_totale.minus(IMPORTO_BOLLO);
      const nuovoMesePrezzo = mese.prezzo.minus(IMPORTO_BOLLO);
      const bolloCodice = buildLegacyBolloPlaceholder(invoice.id);

      console.log(
        `  - id=${invoice.id} utente=${invoice.id_Utente} fattura=${invoice.n_fattura}/${invoice.anno}: ` +
          `prezzo_totale ${invoice.prezzo_totale} -> ${nuovoTotale}, ` +
          `mese[${mese.mese}].prezzo ${mese.prezzo} -> ${nuovoMesePrezzo}, ` +
          `bolloCodice -> ${bolloCodice}`
      );

      if (APPLY) {
        await prisma.$transaction([
          prisma.pagamento.update({
            where: { id: invoice.id },
            data: { prezzo_totale: nuovoTotale, bolloCodice },
          }),
          prisma.fatturaMese.update({
            where: { id: mese.id },
            data: { prezzo: nuovoMesePrezzo },
          }),
        ]);
      }
    }

    if (APPLY) {
      console.log(`[fix-legacy-bollo] applicate ${toFix.length} correzioni.`);
    } else {
      console.log(
        "[fix-legacy-bollo] DRY-RUN: nessuna scrittura eseguita. Fai un backup, poi rilancia con --apply per applicare davvero."
      );
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
