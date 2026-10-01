import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/login";
import { TEST_USER, TEST_USER_B } from "./fixtures/test-user";
import {
  createTestInvoice,
  createTestPatient,
  createTestPayer,
  createTestTrasmissione,
  deleteTestPayerCascade,
  uniqueSuffix,
} from "./fixtures/prisma-test-fixtures";

// Ogni utente vede solo i propri dati (CLAUDE.md, multi-tenant applicativo).
// Qui lo si verifica attraverso le route e le pagine vere, non solo nei
// test unitari: l'utente B prova a raggiungere i dati dell'utente A.
test.describe("isolamento tra utenti", () => {
  const suffix = uniqueSuffix();
  const nomePaganteA = `E2E${suffix}A`;
  const protocollo = `E2E-ISO-${suffix}`;
  let idPaganteA: number;
  let idFatturaA: number;
  let idTrasmissioneA: number;

  test.beforeAll(async () => {
    const pagante = await createTestPayer(`${suffix}A`, { username: TEST_USER.username });
    const paziente = await createTestPatient(pagante.id, `${suffix}A`);
    const fattura = await createTestInvoice(pagante.id, paziente.id, {
      stato_ts: "INVIATA",
      protocollo_ts: protocollo,
      data_invio_ts: new Date(),
    });
    const trasmissione = await createTestTrasmissione([fattura.id], {
      username: TEST_USER.username,
      protocollo,
      pdfRicevuta: new TextEncoder().encode("%PDF-1.4 ricevuta e2e"),
    });
    idPaganteA = pagante.id;
    idFatturaA = fattura.id;
    idTrasmissioneA = trasmissione.id;
  });

  test.afterAll(async () => {
    await deleteTestPayerCascade(idPaganteA);
  });

  test("il proprietario scarica PDF e ricevuta e vede i propri dati", async ({ page }) => {
    await loginAsTestUser(page, TEST_USER);

    const pdf = await page.request.get(`/api/invoices/${idFatturaA}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");

    const ricevuta = await page.request.get(`/api/sistema-ts/trasmissioni/${idTrasmissioneA}/ricevuta`);
    expect(ricevuta.status()).toBe(200);

    // Controllo positivo: gli stessi dati che l'utente B non deve vedere
    // (test successivo) compaiono per il proprietario nelle stesse pagine.
    await page.goto("/invoices?f=1");
    await expect(page.getByText(nomePaganteA).first()).toBeVisible();
    await page.goto(`/payers?q=${nomePaganteA}`);
    await expect(page.getByText(nomePaganteA).first()).toBeVisible();
    await page.goto("/sistema-ts?stato=ALL");
    await expect(page.getByText(nomePaganteA).first()).toBeVisible();
    await page.getByRole("button", { name: /Storico Trasmissioni/i }).click();
    await expect(page.getByText(protocollo).first()).toBeVisible();
  });

  test("un altro utente riceve 404 sulle route dei file dell'utente A", async ({ page }) => {
    await loginAsTestUser(page, TEST_USER_B);

    const pdf = await page.request.get(`/api/invoices/${idFatturaA}/pdf`);
    expect(pdf.status()).toBe(404);

    const ricevuta = await page.request.get(`/api/sistema-ts/trasmissioni/${idTrasmissioneA}/ricevuta`);
    expect(ricevuta.status()).toBe(404);
  });

  test("un altro utente non vede fattura, pagante e trasmissione dell'utente A", async ({ page }) => {
    await loginAsTestUser(page, TEST_USER_B);

    await page.goto("/invoices?f=1");
    await expect(page.getByRole("heading", { name: "Fatture", level: 1 })).toBeVisible();
    await expect(page.getByText(nomePaganteA)).toHaveCount(0);

    await page.goto(`/payers?q=${nomePaganteA}`);
    await expect(page.getByRole("heading", { name: /Paganti/i, level: 1 })).toBeVisible();
    await expect(page.getByText(nomePaganteA)).toHaveCount(0);

    await page.goto("/sistema-ts?stato=ALL");
    await expect(page.getByRole("heading", { name: /Sistema Tessera Sanitaria/i, level: 1 })).toBeVisible();
    await expect(page.getByText(nomePaganteA)).toHaveCount(0);
    await page.getByRole("button", { name: /Storico Trasmissioni/i }).click();
    await expect(page.getByText(protocollo)).toHaveCount(0);
  });

  test("senza sessione le route dei file rispondono 401", async ({ request }) => {
    const pdf = await request.get(`/api/invoices/${idFatturaA}/pdf`);
    expect(pdf.status()).toBe(401);
    const ricevuta = await request.get(`/api/sistema-ts/trasmissioni/${idTrasmissioneA}/ricevuta`);
    expect(ricevuta.status()).toBe(401);
  });
});
