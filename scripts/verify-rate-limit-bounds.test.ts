import { it, expect } from "vitest";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  MAX_ENTRIES_PER_MAP,
  sweepExpired,
} from "../lib/auth/rate-limit";

// Le Map di lib/auth/rate-limit.ts vivono in memoria di
// processo. Senza un tetto, un attaccante che manda uno username/IP diverso
// a ogni tentativo di login le fa crescere senza limite. Questo test verifica
// il comportamento osservabile (non lo stato interno): un tetto fisso con
// eviction della voce meno recentemente scritta, e uno sweep che rimuove le
// voci scadute indipendentemente dal traffico.

it("sweepExpired rimuove una voce bloccata una volta scaduta", () => {
  const sweepUser = "sweep_test_user";
  const sweepIp = "sweep_test_ip";
  for (let i = 0; i < 5; i++) recordFailedLogin(sweepUser, sweepIp);

  expect(
    checkLoginRateLimit(sweepUser, sweepIp).allowed,
    "dopo 5 fallimenti la coppia (username, ip) dovrebbe essere bloccata"
  ).toBe(false);

  // now molto nel futuro: qualunque lockedUntil/windowStart risulta scaduto,
  // indipendentemente da quando il test viene eseguito realmente.
  sweepExpired(Date.now() + 24 * 60 * 60 * 1000);

  expect(
    checkLoginRateLimit(sweepUser, sweepIp).allowed,
    "sweepExpired con un now nel futuro dovrebbe rimuovere una voce scaduta, sbloccando la coppia"
  ).toBe(true);
});

it("eviction della voce meno recentemente scritta oltre il tetto", () => {
  const oldestUser = "lru_test_oldest";
  const oldestIp = "lru_test_oldest_ip";
  for (let i = 0; i < 5; i++) recordFailedLogin(oldestUser, oldestIp);

  expect(
    checkLoginRateLimit(oldestUser, oldestIp).allowed,
    "la voce più vecchia dovrebbe essere bloccata subito dopo la scrittura"
  ).toBe(false);

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

  expect(
    checkLoginRateLimit(oldestUser, oldestIp).allowed,
    "la voce più vecchia dovrebbe risultare evitta (sbloccata) una volta superato MAX_ENTRIES_PER_MAP"
  ).toBe(true);
  expect(
    checkLoginRateLimit(newestUser, newestIp).allowed,
    "la voce scritta più di recente non deve essere evitta: deve restare bloccata"
  ).toBe(false);
});
