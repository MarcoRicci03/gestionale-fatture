import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { loginAsTestUser } from "./fixtures/login";
import {
  createTestInvoice,
  createTestPatient,
  createTestPayer,
  deleteTestPayerCascade,
  uniqueSuffix,
} from "./fixtures/prisma-test-fixtures";

// Una fattura già inviata al Sistema TS è un documento trasmesso: non si
// modifica e non si cancella. "Elimina" diventa una richiesta di
// annullamento telematico, con la sua conferma.
test.describe("fattura già inviata al Sistema TS", () => {
  const suffix = uniqueSuffix();
  const nomePagante = `E2E${suffix}I`;
  let idPagante: number;
  let idFattura: number;
  let numero: string;

  test.beforeAll(async () => {
    const pagante = await createTestPayer(`${suffix}I`);
    const paziente = await createTestPatient(pagante.id, `${suffix}I`);
    const fattura = await createTestInvoice(pagante.id, paziente.id, {
      stato_ts: "INVIATA",
      protocollo_ts: `E2E-INV-${suffix}`,
      data_invio_ts: new Date(),
    });
    idPagante = pagante.id;
    idFattura = fattura.id;
    numero = `${fattura.n_fattura}/${fattura.anno}`;
  });

  test.afterAll(async () => {
    await deleteTestPayerCascade(idPagante);
  });

  test("modifica e aggiornamento anagrafica sono disabilitati", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/invoices?f=1");
    const riga = page.locator("tbody tr", { hasText: nomePagante });

    await expect(
      riga.getByRole("button", { name: "Fattura già inviata al Sistema TS (non modificabile)" })
    ).toBeDisabled();
    await expect(
      riga.getByRole("button", { name: "Fattura già inviata al Sistema TS (anagrafica non modificabile)" })
    ).toBeDisabled();
  });

  test("elimina apre l'annullamento TS invece di cancellare la fattura", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/invoices?f=1");
    const riga = page.locator("tbody tr", { hasText: nomePagante });

    await riga.getByRole("button", { name: "Annulla fattura su Sistema TS" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Annulla fattura su Sistema TS" })).toBeVisible();

    // La conferma richiede di digitare numero/anno; il test chiude senza
    // confermare, così nulla parte verso Sogei.
    const conferma = dialog.getByRole("button", { name: "Conferma annullamento TS" });
    await expect(conferma).toBeDisabled();
    await dialog.getByRole("textbox").fill(numero);
    await expect(conferma).toBeEnabled();
    await dialog.getByRole("button", { name: "Chiudi" }).click();
    await expect(dialog).toBeHidden();

    // La fattura è ancora lì, invariata.
    const fattura = await prisma.pagamento.findUniqueOrThrow({ where: { id: idFattura } });
    expect(fattura.stato_ts).toBe("INVIATA");
  });
});
