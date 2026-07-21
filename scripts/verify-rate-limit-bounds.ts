// Regressione SEC-04: le Map di lib/auth/rate-limit.ts vivono in memoria di
// processo. Senza un tetto, un attaccante che manda uno username/IP diverso
// a ogni tentativo di login le fa crescere senza limite. Questo script
// verifica il comportamento osservabile (non lo stato interno): un tetto
// fisso con eviction della voce meno recentemente scritta, e uno sweep che
// rimuove le voci scadute indipendentemente dal traffico.
import {
  checkLoginRateLimit,
  recordFailedLogin,
  MAX_ENTRIES_PER_MAP,
  sweepExpired,
} from "../lib/auth/rate-limit";

const failures: string[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

// --- Test 1: sweepExpired rimuove una voce bloccata una volta scaduta ---
const sweepUser = "sweep_test_user";
const sweepIp = "sweep_test_ip";
for (let i = 0; i < 5; i++) recordFailedLogin(sweepUser, sweepIp);

const lockedBeforeSweep = checkLoginRateLimit(sweepUser, sweepIp);
assert(
  lockedBeforeSweep.allowed === false,
  "dopo 5 fallimenti la coppia (username, ip) dovrebbe essere bloccata"
);

// now molto nel futuro: qualunque lockedUntil/windowStart risulta scaduto,
// indipendentemente da quando il test viene eseguito realmente.
sweepExpired(Date.now() + 24 * 60 * 60 * 1000);

const allowedAfterSweep = checkLoginRateLimit(sweepUser, sweepIp);
assert(
  allowedAfterSweep.allowed === true,
  "sweepExpired con un now nel futuro dovrebbe rimuovere una voce scaduta, sbloccando la coppia"
);

// --- Test 2: eviction della voce meno recentemente scritta oltre il tetto ---
const oldestUser = "lru_test_oldest";
const oldestIp = "lru_test_oldest_ip";
for (let i = 0; i < 5; i++) recordFailedLogin(oldestUser, oldestIp);

const oldestLockedBeforeEviction = checkLoginRateLimit(oldestUser, oldestIp);
assert(
  oldestLockedBeforeEviction.allowed === false,
  "la voce più vecchia dovrebbe essere bloccata subito dopo la scrittura"
);

// Riempie la Map fino al tetto con chiavi distinte (1 fallimento ciascuna,
// non abbastanza per bloccarle): porta la Map esattamente a
// MAX_ENTRIES_PER_MAP voci, senza ancora far scattare l'eviction.
for (let i = 0; i < MAX_ENTRIES_PER_MAP - 1; i++) {
  recordFailedLogin(`lru_test_filler_${i}`, `lru_test_filler_ip_${i}`);
}

const newestUser = "lru_test_newest";
const newestIp = "lru_test_newest_ip";
// La prima di queste 5 scritture introduce la (MAX_ENTRIES_PER_MAP+1)-esima
// chiave distinta: fa scattare l'eviction della voce meno recentemente
// scritta, cioè oldestUser/oldestIp.
for (let i = 0; i < 5; i++) recordFailedLogin(newestUser, newestIp);

const oldestAfterEviction = checkLoginRateLimit(oldestUser, oldestIp);
assert(
  oldestAfterEviction.allowed === true,
  "la voce più vecchia dovrebbe risultare evitta (sbloccata) una volta superato MAX_ENTRIES_PER_MAP"
);

const newestAfterEviction = checkLoginRateLimit(newestUser, newestIp);
assert(
  newestAfterEviction.allowed === false,
  "la voce scritta più di recente non deve essere evitta: deve restare bloccata"
);

if (failures.length > 0) {
  console.error("verify-rate-limit-bounds: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "Le Map di lib/auth/rate-limit.ts rispettano MAX_ENTRIES_PER_MAP con eviction della voce meno recentemente scritta, e sweepExpired rimuove correttamente le voci scadute."
);
