import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/login";
import {
  createTestPayer,
  createTestPatient,
  deleteTestPayerCascade,
  uniqueSuffix,
} from "./fixtures/prisma-test-fixtures";

test.describe("archiviazione pagante con cascata sui pazienti", () => {
  const suffix = uniqueSuffix();
  const payerLabel = `PaganteTest E2E${suffix}`;
  const patientLabel = `PazienteTest E2E${suffix}`;
  let payerId: number;

  test.beforeAll(async () => {
    const payer = await createTestPayer(suffix);
    payerId = payer.id;
    await createTestPatient(payer.id, suffix);
  });

  test.afterAll(async () => {
    await deleteTestPayerCascade(payerId);
  });

  test("archivia il pagante e archivia in cascata il paziente collegato", async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await page.goto("/payers");

    const activeRow = page.getByRole("row", { name: new RegExp(payerLabel) });
    await expect(activeRow).toBeVisible();
    await activeRow.getByRole("button", { name: "Archivia pagante" }).click();
    await page.getByRole("button", { name: "Archivia", exact: true }).click();

    await expect(activeRow).not.toBeVisible();
    await page.getByRole("button", { name: /^Archiviati/ }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(payerLabel) })
    ).toBeVisible();

    await page.goto("/patients");
    await page.getByRole("button", { name: /^Archiviati/ }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(patientLabel) })
    ).toBeVisible();
  });
});

test.describe("ripristino pagante: solo i pazienti archiviati in cascata (LOG-09)", () => {
  const suffix = uniqueSuffix();
  const payerLabel = `PaganteTest E2E${suffix}`;
  const cascataLabel = `PazienteTest E2E${suffix}Cascata`;
  const manualeLabel = `PazienteTest E2E${suffix}Manuale`;
  let payerId: number;

  test.beforeAll(async () => {
    const payer = await createTestPayer(suffix);
    payerId = payer.id;
    await createTestPatient(payer.id, `${suffix}Cascata`);
    await createTestPatient(payer.id, `${suffix}Manuale`);
  });

  test.afterAll(async () => {
    await deleteTestPayerCascade(payerId);
  });

  test("un paziente archiviato manualmente PRIMA del pagante resta archiviato dopo il ripristino del pagante", async ({
    page,
  }) => {
    await loginAsTestUser(page);

    // 1. Archivia manualmente "Manuale", PRIMA di archiviare il pagante.
    await page.goto("/patients");
    const manualeActiveRow = page.getByRole("row", {
      name: new RegExp(manualeLabel),
    });
    await manualeActiveRow
      .getByRole("button", { name: "Archivia paziente" })
      .click();
    await page.getByRole("button", { name: "Archivia", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(manualeActiveRow).not.toBeVisible();

    // 2. Archivia il pagante: la cascata archivia solo "Cascata" (l'unico
    // ancora attivo — "Manuale" è già archiviato al passo 1).
    await page.goto("/payers");
    const payerActiveRow = page.getByRole("row", {
      name: new RegExp(payerLabel),
    });
    await payerActiveRow
      .getByRole("button", { name: "Archivia pagante" })
      .click();
    await page.getByRole("button", { name: "Archivia", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(payerActiveRow).not.toBeVisible();

    // 3. Entrambi i pazienti sono ora tra gli archiviati.
    await page.goto("/patients");
    await page.getByRole("button", { name: /^Archiviati/ }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(cascataLabel) })
    ).toBeVisible();
    await expect(
      page.getByRole("row", { name: new RegExp(manualeLabel) })
    ).toBeVisible();

    // 4. Ripristina il pagante: la dialog di conferma deve promettere il
    // ripristino di 1 solo paziente (quello in cascata), non 2.
    await page.goto("/payers");
    await page.getByRole("button", { name: /^Archiviati/ }).click();
    const payerArchivedRow = page.getByRole("row", {
      name: new RegExp(payerLabel),
    });
    await payerArchivedRow
      .getByRole("button", { name: "Ripristina pagante" })
      .click();
    await expect(page.getByRole("dialog")).toContainText("1 paziente collegato");
    await page.getByRole("button", { name: "Ripristina", exact: true }).click();
    // La dialog si chiude SOLO se restorePayer ha avuto successo (vedi
    // handleConfirm in restore-payer-button.tsx: setOpen(false) è nel ramo
    // di successo, un errore la lascia aperta con il messaggio) — controllo
    // più diretto di "la riga non è più visibile", che potrebbe risultare
    // vero anche a dialog ancora aperta se il dialog nasconde il resto della
    // pagina da un lettore di accessibilità.
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(payerArchivedRow).not.toBeVisible();

    // 5. "Cascata" torna attivo; "Manuale" resta archiviato — è la
    // proprietà che questo test dimostra (prima del fix, tornavano attivi
    // entrambi indiscriminatamente).
    await page.goto("/patients");
    await expect(
      page.getByRole("row", { name: new RegExp(cascataLabel) })
    ).toBeVisible();

    await page.getByRole("button", { name: /^Archiviati/ }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(manualeLabel) })
    ).toBeVisible();
    await expect(
      page.getByRole("row", { name: new RegExp(cascataLabel) })
    ).not.toBeVisible();
  });
});
