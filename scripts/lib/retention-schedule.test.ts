import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { msUntilNextRun } from "./retention-schedule.mjs";

// TZ mutato esplicitamente (stesso pattern di mutableEnv in
// scripts/verify-security-headers.test.ts): il container di produzione fissa
// TZ=Europe/Rome, e msUntilNextRun si appoggia sulle Date locali del
// processo — senza fissare TZ qui, il test dipenderebbe dal fuso della
// macchina che esegue `npm test`.
let previousTz: string | undefined;

beforeEach(() => {
  previousTz = process.env.TZ;
  process.env.TZ = "Europe/Rome";
});

afterEach(() => {
  process.env.TZ = previousTz;
});

describe("msUntilNextRun", () => {
  it("da un giorno feriale, calcola correttamente i giorni fino alla prossima domenica alle 03:00", () => {
    // Mercoledì 2026-07-29 (weekday info verificabile: 2026-07-26 è domenica)
    const now = new Date(2026, 6, 29, 10, 0, 0);
    const waitMs = msUntilNextRun(now, 0, 3);
    const next = new Date(now.getTime() + waitMs);

    expect(next.getDay()).toBe(0);
    expect(next.getHours()).toBe(3);
    expect(next.getMinutes()).toBe(0);
    // da mercoledì 10:00 a domenica 03:00: 3 giorni e 17 ore
    expect(waitMs).toBe((3 * 24 + 17) * 60 * 60 * 1000);
  });

  it("se è già domenica ma dopo le 03:00, rimanda alla domenica successiva (+7 giorni)", () => {
    const now = new Date(2026, 6, 26, 10, 0, 0); // domenica 2026-07-26, ore 10:00
    const waitMs = msUntilNextRun(now, 0, 3);
    const next = new Date(now.getTime() + waitMs);

    expect(next.getDate()).toBe(2); // 2026-08-02, la domenica successiva
    expect(next.getDay()).toBe(0);
    expect(next.getHours()).toBe(3);
  });

  it("se è esattamente domenica alle 03:00:00, non si rischedula su se stesso: il prossimo run è tra 7 giorni", () => {
    const now = new Date(2026, 6, 26, 3, 0, 0, 0);
    const waitMs = msUntilNextRun(now, 0, 3);

    expect(waitMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("a cavallo del cambio ora legale (Europe/Rome passa a ora legale l'ultima domenica di marzo), l'intervallo non è un fisso di 7*86400000 ms", () => {
    // Sabato 2026-03-28, il giorno prima del cambio ora legale (domenica
    // 2026-03-29, le lancette avanzano da 02:00 a 03:00).
    const now = new Date(2026, 2, 28, 10, 0, 0);
    const waitMs = msUntilNextRun(now, 0, 3);
    const next = new Date(now.getTime() + waitMs);

    expect(next.getDay()).toBe(0);
    expect(next.getDate()).toBe(29);
    expect(next.getHours()).toBe(3);
    // Un'ora "in meno" di orologio rispetto al calcolo naive su giorni
    // interi, perché quella notte l'ora legale fa scattare le lancette in
    // avanti: la differenza in ms riflette il tempo reale trascorso, non un
    // multiplo fisso di 24h.
    expect(waitMs).not.toBe((6 * 24 + 17) * 60 * 60 * 1000);
  });
});
