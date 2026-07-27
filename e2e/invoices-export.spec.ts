import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/login";
import {
  createTestPayer,
  createTestPatient,
  createTestInvoice,
  deleteTestPayerCascade,
  uniqueSuffix,
} from "./fixtures/prisma-test-fixtures";

test.describe("esportazione fatture in Excel", () => {
  const suffix = uniqueSuffix();
  let payerId: number;
  let invoiceNFattura: number;

  test.beforeAll(async () => {
    const payer = await createTestPayer(suffix);
    payerId = payer.id;
    const patient = await createTestPatient(payer.id, suffix);
    const invoice = await createTestInvoice(payer.id, patient.id);
    invoiceNFattura = invoice.n_fattura;
  });

  test.afterAll(async () => {
    await deleteTestPayerCascade(payerId);
  });

  test("esporta la fattura selezionata in un file Excel", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/invoices");

    await page
      .getByRole("checkbox", { name: `Seleziona fattura ${invoiceNFattura}` })
      .check();
    await page.getByRole("button", { name: "Esporta Excel" }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Esporta", exact: true }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^fatture-export-.*\.xlsx$/);
    const path = await download.path();
    expect(path).not.toBeNull();
  });
});
