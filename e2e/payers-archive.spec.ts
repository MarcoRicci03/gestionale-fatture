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
