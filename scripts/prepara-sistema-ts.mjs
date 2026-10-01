// Correzione una tantum dei dati esistenti, da lanciare UNA VOLTA in
// produzione subito dopo il deploy del Sistema TS (migration applicate),
// prima di usare la scheda Lotti. Le regole sono in
// scripts/lib/prepara-sistema-ts.mjs.
//
// ESM puro come scripts/fix-legacy-bollo-invoices.mjs: deve girare anche
// nell'immagine di produzione dopo npm prune --omit=dev, con TZ=Europe/Rome.
//
// Uso (backup prima di --apply, es. scripts/backup-db.sh):
//   node scripts/prepara-sistema-ts.mjs --inviate-fino-al=2025-12-31           (simulazione)
//   node scripts/prepara-sistema-ts.mjs --inviate-fino-al=2025-12-31 --apply   (scrive)
//
// --inviate-fino-al è obbligatorio e non ha un valore predefinito: le fatture
// emesse fino a quel giorno incluso vengono segnate come INVIATA perché già
// comunicate al Sistema TS per altre vie.

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { limiteEsclusivo, preparaDatiSistemaTs } from "./lib/prepara-sistema-ts.mjs";

const APPLY = process.argv.includes("--apply");
const argData = process.argv.find((a) => a.startsWith("--inviate-fino-al="));

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[prepara-sistema-ts] DATABASE_URL non configurato.");
    process.exitCode = 1;
    return;
  }

  const inviateFinoAl = argData?.split("=")[1];
  const limite = limiteEsclusivo(inviateFinoAl);
  if (!limite) {
    console.error(
      "[prepara-sistema-ts] Indica la data dell'ultima fattura già comunicata al Sistema TS, es. --inviate-fino-al=2025-12-31"
    );
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const conteggi = await preparaDatiSistemaTs(prisma, { limite, apply: APPLY });
    console.log(`[prepara-sistema-ts] fatture in contanti da segnare come non tracciate: ${conteggi.contantiNonTracciati}`);
    console.log(`[prepara-sistema-ts] fatture con codice bollo da portare a bollo 2,00 €: ${conteggi.bolloDaImpostare}`);
    console.log(`[prepara-sistema-ts] fatture emesse fino al ${inviateFinoAl} da segnare come INVIATA: ${conteggi.giaInviate}`);
    console.log(
      APPLY
        ? "[prepara-sistema-ts] correzioni applicate."
        : "[prepara-sistema-ts] SIMULAZIONE: nessuna scrittura. Fai un backup, poi rilancia con --apply."
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
