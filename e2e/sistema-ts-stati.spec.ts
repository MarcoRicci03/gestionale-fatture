import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { loginAsTestUser } from "./fixtures/login";
import {
  createTestInvoice,
  createTestPatient,
  createTestPayer,
  deleteTestPayerCascade,
  ensureTestTsSettings,
  uniqueSuffix,
} from "./fixtures/prisma-test-fixtures";

// Flussi del Sistema TS che non richiedono una chiamata a Sogei: gli stati di
// partenza (esito incerto, annullamento incerto, fattura annullata) vengono
// preparati nel DB, l'azione si fa dalla UI e l'effetto si verifica nel DB.
// Vedi docs/SISTEMA-TS-COME-FUNZIONA.md per il significato di ogni stato.

const MINUTI = 60 * 1000;

function mezzogiornoDiOggi(): Date {
  const oggi = new Date();
  return new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 12, 0, 0);
}

async function preparaPagante(suffix: string) {
  const pagante = await createTestPayer(suffix);
  const paziente = await createTestPatient(pagante.id, suffix);
  return { pagante, paziente, nome: `E2E${suffix}` };
}

test.describe("Sistema TS — stati e sblocchi", () => {
  const paganti: number[] = [];

  test.beforeAll(async () => {
    await ensureTestTsSettings();
  });

  test.afterAll(async () => {
    for (const id of paganti) await deleteTestPayerCascade(id);
  });

  test("esito incerto: 'Verifica e sblocca' richiede la conferma e sblocca tutto il lotto (CR-10)", async ({ page }) => {
    const { pagante, paziente, nome } = await preparaPagante(`${uniqueSuffix()}V`);
    paganti.push(pagante.id);
    // Due fatture dello stesso lotto (stesso data_invio_ts), con la chiamata a
    // Sogei partita da oltre 5 minuti e senza protocollo: esito incerto.
    const lotto = {
      stato_ts: "IN_TRASMISSIONE" as const,
      data_invio_ts: new Date(Date.now() - 10 * MINUTI),
      invio_avviato_ts: new Date(Date.now() - 9 * MINUTI),
      flag_opposizione: true,
      prezzo_totale: 50,
    };
    const f1 = await createTestInvoice(pagante.id, paziente.id, lotto);
    const f2 = await createTestInvoice(pagante.id, paziente.id, lotto);

    await loginAsTestUser(page);
    await page.goto("/sistema-ts?stato=IN_TRASMISSIONE");
    const riga = page.locator("tbody tr", { hasText: nome }).first();
    await expect(riga.getByText("Esito da verificare")).toBeVisible();

    await riga.getByRole("button", { name: "Verifica e sblocca" }).click();
    const dialog = page.getByRole("dialog");
    const sblocca = dialog.getByRole("button", { name: "Sblocca il lotto" });
    await expect(sblocca).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /Ho verificato sul portale Sistema TS/ }).check();
    await sblocca.click();
    await expect(page.getByText(/Lotto sbloccato: 2 fatture riportate/)).toBeVisible();

    const dopo = await prisma.pagamento.findMany({
      where: { id: { in: [f1.id, f2.id] } },
      select: { stato_ts: true, data_invio_ts: true, invio_avviato_ts: true },
    });
    expect(dopo).toEqual([
      { stato_ts: "DA_INVIARE", data_invio_ts: null, invio_avviato_ts: null },
      { stato_ts: "DA_INVIARE", data_invio_ts: null, invio_avviato_ts: null },
    ]);
  });

  test("annullamento incerto: la conferma resta bloccata finché non si dichiara la verifica (P005)", async ({ page }) => {
    const { pagante, paziente, nome } = await preparaPagante(`${uniqueSuffix()}A`);
    paganti.push(pagante.id);
    const data = mezzogiornoDiOggi();
    const fattura = await createTestInvoice(pagante.id, paziente.id, {
      data,
      stato_ts: "DA_CANCELLARE_SU_TS",
      protocollo_ts: `E2E-ANN-${uniqueSuffix()}`,
      data_invio_ts: new Date(),
      annullamento_incerto_ts: new Date(Date.now() - 10 * MINUTI),
    });

    await loginAsTestUser(page);
    await page.goto("/sistema-ts?stato=DA_CANCELLARE_SU_TS");
    const riga = page.locator("tbody tr", { hasText: nome });
    await expect(riga.getByText("Annullamento da verificare")).toBeVisible();

    await riga.getByRole("button", { name: /Annulla TS/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Numero fattura/i).fill(String(fattura.n_fattura));
    await dialog.getByLabel(/Data emissione/i).fill(data.toLocaleDateString("it-IT"));
    await dialog.getByLabel(/Intestatario fattura/i).fill(`PaganteTest ${nome}`);

    // I tre campi di sicurezza sono giusti, ma senza la dichiarazione di
    // verifica sul portale la conferma resta disabilitata.
    const conferma = dialog.getByRole("button", { name: /Conferma Cancellazione/i });
    await expect(conferma).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /precedente annullamento non risulta acquisito/ }).check();
    await expect(conferma).toBeEnabled();

    // Si chiude senza confermare: nulla parte verso Sogei.
    await dialog.getByRole("button", { name: "Indietro" }).click();
    const dopo = await prisma.pagamento.findUniqueOrThrow({ where: { id: fattura.id } });
    expect(dopo.stato_ts).toBe("DA_CANCELLARE_SU_TS");
    expect(dopo.annullamento_incerto_ts).not.toBeNull();
  });

  test("Correggi: una fattura con CF mancante diventa pronta all'invio", async ({ page }) => {
    const { pagante, paziente, nome } = await preparaPagante(`${uniqueSuffix()}R`);
    paganti.push(pagante.id);
    const fattura = await createTestInvoice(pagante.id, paziente.id, { prezzo_totale: 50 });

    await loginAsTestUser(page);
    await page.goto("/sistema-ts?stato=DA_INVIARE");
    await page.getByRole("button", { name: /^Da correggere\s*\d+$/ }).click();
    const riga = page.locator("tbody tr", { hasText: nome });
    await riga.getByRole("button", { name: "Correggi" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Codice Fiscale Pagante").fill("RSSMRA80A01H501U");
    await expect(dialog.getByText("CF Valido (CIN verificato)")).toBeVisible();
    // Solo la fattura: l'anagrafica del pagante resta com'è.
    await dialog.getByRole("checkbox", { name: /Aggiorna anche l'anagrafica del cliente/ }).uncheck();
    await dialog.getByRole("button", { name: "Salva correzioni" }).click();
    await expect(dialog).toBeHidden();

    // Ora compare tra le pronte ed è selezionabile.
    await page.getByRole("button", { name: /^Pronte all'invio\s*\d+$/ }).click();
    await expect(page.locator("tbody tr", { hasText: nome }).getByRole("checkbox")).toBeEnabled();

    const dopo = await prisma.pagamento.findUniqueOrThrow({ where: { id: fattura.id } });
    expect(dopo.snapshotAnagrafica).toMatchObject({ pagante: { cf: "RSSMRA80A01H501U" } });
    const paganteDopo = await prisma.pagante.findUniqueOrThrow({ where: { id: pagante.id } });
    expect(paganteDopo.cf).toBeNull();
  });

  test("Ripristina: una fattura annullata su TS torna da inviare", async ({ page }) => {
    const { pagante, paziente, nome } = await preparaPagante(`${uniqueSuffix()}X`);
    paganti.push(pagante.id);
    const fattura = await createTestInvoice(pagante.id, paziente.id, {
      stato_ts: "ANNULLATA_TS",
      protocollo_ts: `E2E-RIP-${uniqueSuffix()}`,
      data_invio_ts: new Date(),
    });

    await loginAsTestUser(page);
    await page.goto("/sistema-ts?stato=ANNULLATA_TS");
    await page.locator("tbody tr", { hasText: nome }).getByRole("button", { name: "Ripristina" }).click();
    await expect(page.getByText(/ripristinata su "Da Inviare"/)).toBeVisible();

    const dopo = await prisma.pagamento.findUniqueOrThrow({ where: { id: fattura.id } });
    expect(dopo.stato_ts).toBe("DA_INVIARE");
    expect(dopo.protocollo_ts).toBeNull();
  });
});
