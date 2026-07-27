import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/login";
import {
  createTestPayer,
  createTestPatient,
  deleteTestPayerCascade,
  uniqueSuffix,
} from "./fixtures/prisma-test-fixtures";

// Il secondo test dipende dalla fattura creata dal primo: se la creazione
// fallisce, non ha senso provare a scaricarne il PDF.
test.describe.configure({ mode: "serial" });

test.describe("ciclo di vita di una fattura", () => {
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

  test("crea una fattura e la mostra in elenco", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/invoices");
    await page.getByRole("button", { name: "Nuova fattura" }).click();

    await page.getByLabel("Pagante").selectOption({ label: payerLabel });
    // Attende che l'effect di InvoiceForm abbia copiato città/CAP dal
    // pagante selezionato, prima di proseguire e sottomettere il form.
    await expect(page.getByLabel("Città")).toHaveValue("Roma");

    await page.getByLabel("Paziente").selectOption({ label: patientLabel });
    await page.getByLabel("Modalità di pagamento").selectOption("CONTANTI");
    await page.locator('input[aria-label^="Importo per"]').fill("100");

    await page.getByRole("button", { name: "Crea fattura" }).click();

    const row = page.getByRole("row", { name: new RegExp(payerLabel) });
    await expect(row).toBeVisible();
  });

  test("scarica il PDF della fattura creata", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/invoices");

    const row = page.getByRole("row", { name: new RegExp(payerLabel) });
    await expect(row).toBeVisible();

    const pdfLink = row.getByRole("link", { name: "Scarica PDF" });
    const href = await pdfLink.getAttribute("href");
    if (!href) throw new Error("Il link 'Scarica PDF' non ha un href");

    const response = await page.request.get(href);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
  });
});
