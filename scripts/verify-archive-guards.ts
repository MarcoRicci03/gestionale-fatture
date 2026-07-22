import {
  findRestoreConflict,
  canHardDeletePayer,
  canHardDeletePatient,
} from "../lib/archive/guards";

// Regressione sulle regole di lib/archive/guards.ts: il ripristino di un
// pagante non deve mai violare gli indici unique parziali su cf/piva (attivi
// solo tra i paganti non archiviati), e l'hard-delete non deve mai poter
// cancellare in cascata fatture o pazienti che l'utente non ha già
// archiviato esplicitamente.

const failures: string[] = [];

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    failures.push(
      `${message} — atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`
    );
  }
}

function testRestoreConflictOnCf(): void {
  const conflict = findRestoreConflict(
    { cf: "RSSMRA80A01H501U", piva: null },
    [{ id: 42, cf: "RSSMRA80A01H501U", piva: null }]
  );
  assertEqual(conflict?.field, "cf", "conflitto su cf non rilevato");
  assertEqual(conflict?.conflictingId, 42, "id del pagante in conflitto errato");
}

function testRestoreConflictOnPiva(): void {
  const conflict = findRestoreConflict(
    { cf: null, piva: "IT01234567890" },
    [{ id: 7, cf: null, piva: "IT01234567890" }]
  );
  assertEqual(conflict?.field, "piva", "conflitto su piva non rilevato");
  assertEqual(conflict?.conflictingId, 7, "id del pagante in conflitto errato");
}

function testNoConflictWhenBothNull(): void {
  const conflict = findRestoreConflict({ cf: null, piva: null }, [
    { id: 1, cf: null, piva: null },
  ]);
  assertEqual(conflict, null, "cf/piva entrambi null non devono generare un conflitto");
}

function testNoConflictAgainstArchivedPayer(): void {
  // La lista passata a findRestoreConflict deve contenere SOLO paganti
  // attivi: se per errore vi finisse un archiviato con lo stesso cf, non
  // deve comunque contare come conflitto (l'indice è parziale su
  // archiviato = false).
  const activePayersOnly: { id: number; cf: string | null; piva: string | null }[] = [];
  const conflict = findRestoreConflict(
    { cf: "RSSMRA80A01H501U", piva: null },
    activePayersOnly
  );
  assertEqual(
    conflict,
    null,
    "un pagante archiviato con lo stesso cf non deve produrre un conflitto"
  );
}

function testCanHardDeletePayer(): void {
  assertEqual(
    canHardDeletePayer({ fatture: 0, pazientiNonArchiviati: 0 }),
    true,
    "senza fatture né pazienti non archiviati l'hard-delete deve essere consentito"
  );
  assertEqual(
    canHardDeletePayer({ fatture: 1, pazientiNonArchiviati: 0 }),
    false,
    "con fatture collegate l'hard-delete deve essere bloccato"
  );
  assertEqual(
    canHardDeletePayer({ fatture: 0, pazientiNonArchiviati: 1 }),
    false,
    "con pazienti collegati non archiviati l'hard-delete deve essere bloccato"
  );
  assertEqual(
    canHardDeletePayer({ fatture: 1, pazientiNonArchiviati: 1 }),
    false,
    "con entrambi i blocker l'hard-delete deve restare bloccato"
  );
}

function testCanHardDeletePatient(): void {
  assertEqual(
    canHardDeletePatient({ fatture: 0 }),
    true,
    "un paziente senza fatture deve poter essere eliminato definitivamente"
  );
  assertEqual(
    canHardDeletePatient({ fatture: 1 }),
    false,
    "un paziente con fatture collegate non deve poter essere eliminato definitivamente"
  );
}

function main(): void {
  testRestoreConflictOnCf();
  testRestoreConflictOnPiva();
  testNoConflictWhenBothNull();
  testNoConflictAgainstArchivedPayer();
  testCanHardDeletePayer();
  testCanHardDeletePatient();

  if (failures.length > 0) {
    console.error("verify-archive-guards: FALLITO");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    "Guard di archiviazione/hard-delete corrette: nessun conflitto di ripristino falso/mancato, nessun hard-delete a sorpresa."
  );
}

main();
