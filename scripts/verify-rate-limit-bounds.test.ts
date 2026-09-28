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
// eviction della voce meno recentemente scritta tra quelle non bloccate
// (CR-13), e uno sweep che rimuove le voci scadute indipendentemente dal
// traffico.

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

// CR-13: il tetto non deve costare un lockout. Un attaccante che spruzza
// login falliti su username inventati riempie la Map di voci da un tentativo:
// sono quelle, non le coppie bloccate, a dover essere espulse.
it("oltre il tetto espelle le voci non bloccate e conserva i lockout (CR-13)", () => {
  const victimUser = "lru_test_victim";
  const victimIp = "lru_test_victim_ip";
  for (let i = 0; i < 5; i++) recordFailedLogin(victimUser, victimIp);

  expect(
    checkLoginRateLimit(victimUser, victimIp).allowed,
    "dopo 5 fallimenti la coppia della vittima dovrebbe essere bloccata"
  ).toBe(false);

  const firstFillerUser = "lru_test_filler_0";
  const firstFillerIp = "lru_test_filler_ip_0";
  // Ben oltre il tetto: ogni voce nuova fa scattare un'eviction.
  for (let i = 0; i < MAX_ENTRIES_PER_MAP + 500; i++) {
    recordFailedLogin(`lru_test_filler_${i}`, `lru_test_filler_ip_${i}`);
  }

  expect(
    checkLoginRateLimit(victimUser, victimIp).allowed,
    "la coppia bloccata non deve essere espulsa dallo spray di username nuovi"
  ).toBe(false);

  // Il primo filler (1 tentativo, non bloccato) è stato espulso: un nuovo
  // fallimento riparte da zero, quindi dopo 4 fallimenti non è ancora bloccato.
  for (let i = 0; i < 4; i++) recordFailedLogin(firstFillerUser, firstFillerIp);
  expect(
    checkLoginRateLimit(firstFillerUser, firstFillerIp).allowed,
    "il filler più vecchio, non bloccato, dovrebbe essere stato espulso"
  ).toBe(true);

  sweepExpired(Date.now() + 24 * 60 * 60 * 1000);
});
