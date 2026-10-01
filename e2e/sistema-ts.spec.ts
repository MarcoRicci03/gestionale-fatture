import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/login";
import {
  createTestInvoice,
  createTestPatient,
  createTestPayer,
  deleteTestPayerCascade,
  ensureTestTsSettings,
  uniqueSuffix,
} from "./fixtures/prisma-test-fixtures";

test.describe("Sistema TS — E2E Browser Tests", () => {
  // Dati propri dell'utente e2e, senza dipendere da `npm run seed:dev`:
  // - una fattura pronta (opposizione: il CF non è richiesto);
  // - una fattura da correggere (pagante senza CF);
  // - una fattura già inviata, per il dialog di annullamento.
  const suffix = uniqueSuffix();
  const nomePronta = `E2E${suffix}P`;
  const nomeDaCorreggere = `E2E${suffix}C`;
  const protocolloInviata = `E2E-${suffix}`;
  const paganti: number[] = [];

  test.beforeAll(async () => {
    await ensureTestTsSettings();

    const pronto = await createTestPayer(`${suffix}P`);
    const pazientePronto = await createTestPatient(pronto.id, `${suffix}P`);
    await createTestInvoice(pronto.id, pazientePronto.id, { prezzo_totale: 50, flag_opposizione: true });
    await createTestInvoice(pronto.id, pazientePronto.id, {
      prezzo_totale: 50,
      flag_opposizione: true,
      stato_ts: "INVIATA",
      protocollo_ts: protocolloInviata,
      data_invio_ts: new Date(),
    });

    const senzaCf = await createTestPayer(`${suffix}C`);
    const pazienteSenzaCf = await createTestPatient(senzaCf.id, `${suffix}C`);
    await createTestInvoice(senzaCf.id, pazienteSenzaCf.id, { prezzo_totale: 50 });

    paganti.push(pronto.id, senzaCf.id);
  });

  test.afterAll(async () => {
    for (const id of paganti) await deleteTestPayerCascade(id);
  });

  test("mostra il Top Banner di sviluppo sia nella login che nell'area protetta", async ({ page }) => {
    // 1. Pagina di Login
    await page.goto("/login");
    const loginBanner = page.getByRole("status", { name: "Avviso ambiente di sviluppo" });
    await expect(loginBanner).toBeVisible();
    await expect(loginBanner).toContainText("Ambiente di Sviluppo");
    await page.screenshot({ path: "test-results/screenshots/01-login-dev-banner.png" });

    // 2. Area Protetta (Dashboard)
    await loginAsTestUser(page);
    const protectedBanner = page.getByRole("status", { name: "Avviso ambiente di sviluppo" });
    await expect(protectedBanner).toBeVisible();
    await expect(protectedBanner).toContainText("Ambiente di Sviluppo");
    await page.screenshot({ path: "test-results/screenshots/02-dashboard-dev-banner.png" });
  });

  test("navigazione alla sezione Sistema TS, filtri e indicatori CF", async ({ page }) => {
    await loginAsTestUser(page);
    
    // Clicca sulla voce Sistema TS esatta nella sidebar
    await page.getByRole("link", { name: "Sistema TS", exact: true }).click();
    await expect(page).toHaveURL(/\/sistema-ts/);

    // Verifica titolo pagina
    await expect(page.getByRole("heading", { name: /Sistema Tessera Sanitaria/i, level: 1 })).toBeVisible();

    // Verifica presenza della barra filtri
    await expect(page.getByLabel("Data da")).toBeVisible();
    await expect(page.getByLabel("Data a")).toBeVisible();
    await expect(page.getByLabel("Stato Fattura")).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtra" })).toBeVisible();

    // Verifica interazione filtri: cambia stato e filtra
    await page.getByLabel("Stato Fattura").selectOption("ALL");
    await page.getByRole("button", { name: "Filtra" }).click();
    await expect(page).toHaveURL(/stato=ALL/);

    // Verifica presenza del tab Storico Trasmissioni
    await expect(page.getByRole("button", { name: /Storico Trasmissioni/i })).toBeVisible();

    await page.screenshot({ path: "test-results/screenshots/03-sistema-ts-table.png" });
  });

  test("le fatture con CF errato non sono selezionabili per l'invio", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/sistema-ts?stato=DA_INVIARE");
    await expect(page.getByRole("heading", { name: /Sistema Tessera Sanitaria/i, level: 1 })).toBeVisible();

    // Il filtro predefinito mostra solo le fatture pronte: con "Tutte" compare
    // anche quella da correggere.
    await page.getByRole("button", { name: /^Tutte\s*\d+$/ }).click();
    const checkboxPronta = page.locator("tbody tr", { hasText: nomePronta }).getByRole("checkbox");
    const checkboxDaCorreggere = page.locator("tbody tr", { hasText: nomeDaCorreggere }).getByRole("checkbox");

    // Le fatture con anomalie hanno la checkbox disabilitata.
    await expect(checkboxPronta).toBeEnabled();
    await expect(checkboxDaCorreggere).toBeDisabled();
    await page.screenshot({ path: "test-results/screenshots/07-sistema-ts-invoices.png" });

    // 1. "Seleziona tutte" prende la pronta e lascia fuori quella da correggere
    const selectAllCheckbox = page.getByRole("checkbox", { name: "Seleziona tutte le fatture" });
    await selectAllCheckbox.check();
    await page.screenshot({ path: "test-results/screenshots/08-sistema-ts-selection.png" });

    const sendButton = page.getByRole("button", { name: /Invia a Sistema TS/i });
    await expect(sendButton).toBeEnabled();
    await expect(checkboxPronta).toBeChecked();
    await expect(checkboxDaCorreggere).not.toBeChecked();

    // Deseleziona tutto
    await selectAllCheckbox.uncheck();
    await expect(sendButton).toBeHidden();

    // 2. Una singola fattura pronta rende di nuovo disponibile l'invio
    await checkboxPronta.check();
    await expect(sendButton).toBeEnabled();
  });

  test("verifica modale di sicurezza per cancellazione telematica (Annulla TS)", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/sistema-ts?stato=INVIATA");
    await expect(page.getByRole("heading", { name: /Sistema Tessera Sanitaria/i, level: 1 })).toBeVisible();

    const rigaInviata = page.locator("tbody tr", { hasText: nomePronta });
    await rigaInviata.getByRole("button", { name: /Annulla TS/i }).click();

    await expect(page.getByRole("heading", { name: /Annullamento Spesa su Sistema TS/i })).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/04-cancel-modal.png" });

    // Il pulsante di conferma resta disabilitato finché i campi di sicurezza
    // non corrispondono. Il test chiude senza annullare: nulla parte verso Sogei.
    await expect(page.getByRole("button", { name: /Conferma Cancellazione/i })).toBeDisabled();
    await page.getByRole("button", { name: "Indietro" }).click();
    await expect(page.getByRole("heading", { name: /Annullamento Spesa su Sistema TS/i })).toBeHidden();
  });

  test("pagina impostazioni Sistema TS: credenziali cifrate e toggle visibilità password e pincode", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/settings/sistema-ts");

    // Verifica campi di configurazione
    await expect(page.getByRole("heading", { name: /Impostazioni Sistema TS/i, level: 1 })).toBeVisible();
    await expect(page.getByLabel(/Username \/ Codice Fiscale/i)).toBeVisible();
    
    const pwdInput = page.getByLabel(/Password TS/i);
    await expect(pwdInput).toBeVisible();
    await expect(pwdInput).toHaveAttribute("type", "password");

    const pinInput = page.getByLabel(/PinCode TS/i);
    await expect(pinInput).toBeVisible();
    await expect(pinInput).toHaveAttribute("type", "password");

    // Test toggle visibilità password
    const togglePwdBtn = page.getByRole("button", { name: "Mostra password" });
    await togglePwdBtn.click();
    await expect(pwdInput).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Nascondi password" }).click();
    await expect(pwdInput).toHaveAttribute("type", "password");

    // Test toggle visibilità pincode
    const togglePinBtn = page.getByRole("button", { name: "Mostra pincode" });
    await togglePinBtn.click();
    await expect(pinInput).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Nascondi pincode" }).click();
    await expect(pinInput).toHaveAttribute("type", "password");

    await page.screenshot({ path: "test-results/screenshots/05-sistema-ts-settings.png" });
  });

  test("responsività mobile: layout card al posto della tabella su schermi piccoli", async ({ page }) => {
    // Imposta viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/login");
    const mobileBanner = page.getByRole("status", { name: "Avviso ambiente di sviluppo" });
    await expect(mobileBanner).toBeVisible();

    await loginAsTestUser(page);
    await page.goto("/sistema-ts");

    // Su mobile la tabella desktop deve essere nascosta
    const desktopTable = page.locator(".hidden.lg\\:block table");
    await expect(desktopTable).toBeHidden();

    // Verifica la presenza dell'header mobile
    await expect(page.getByRole("button", { name: "Apri menu" })).toBeVisible();

    await page.screenshot({ path: "test-results/screenshots/06-sistema-ts-mobile.png" });
  });

  test("verifica che l'header della tabella rimane visibile durante lo scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAsTestUser(page);
    await page.goto("/sistema-ts?stato=ALL");
    await page.waitForSelector("table");

    const scrollMetrics = await page.evaluate(() => {
      const table = document.querySelector("table");
      const thead = table?.querySelector("thead");
      const scrollParent = table?.closest(".overflow-y-auto, .overflow-auto");
      if (!table || !thead || !scrollParent) return null;

      const parentTop = scrollParent.getBoundingClientRect().top;
      const beforeTop = thead.getBoundingClientRect().top;

      scrollParent.scrollTop = 500;

      const afterTop = thead.getBoundingClientRect().top;

      const th = thead.querySelector("th");
      const computedTable = table ? window.getComputedStyle(table) : null;
      const computedTh = th ? window.getComputedStyle(th) : null;

      return {
        parentTop,
        beforeTop,
        afterTop,
        diff: Math.abs(afterTop - parentTop),
        tableBorderCollapse: computedTable?.borderCollapse,
        thBorderBottom: computedTh?.borderBottom,
      };
    });

    expect(scrollMetrics).not.toBeNull();
    // Dopo lo scroll di 500px, l'header deve rimanere bloccato in cima al container (tolleranza 2px per bordo)
    expect(scrollMetrics!.diff).toBeLessThanOrEqual(2);
    // Verifica che la tabella usi border-separate per non far sparire il bordo di separazione durante lo scroll
    expect(scrollMetrics!.tableBorderCollapse).toBe("separate");
    // Verifica che ci sia sempre la riga di separazione dell'header
    expect(scrollMetrics!.thBorderBottom).toMatch(/1px solid/);

    await page.screenshot({ path: "test-results/screenshots/scrolled-table-header.png" });

    // Test sticky header on /invoices as well. `f=1` senza date mostra tutte
    // le fatture: senza, /invoices filtra sul mese corrente e le fatture del
    // seed (febbraio 2026) non comparirebbero.
    await page.goto("/invoices?f=1");
    await page.waitForSelector("table");

    const invoicesScrollMetrics = await page.evaluate(() => {
      const table = document.querySelector("table");
      const thead = table?.querySelector("thead");
      const scrollParent = table?.closest(".overflow-y-auto, .overflow-auto");
      if (!table || !thead || !scrollParent) return null;

      const parentTop = scrollParent.getBoundingClientRect().top;
      const beforeTop = thead.getBoundingClientRect().top;

      scrollParent.scrollTop = 500;

      const afterTop = thead.getBoundingClientRect().top;

      return {
        parentTop,
        beforeTop,
        afterTop,
        diff: Math.abs(afterTop - parentTop),
      };
    });

    console.log("SCROLL METRICS REAL (Invoices):", invoicesScrollMetrics);
    expect(invoicesScrollMetrics).not.toBeNull();
    expect(invoicesScrollMetrics!.diff).toBeLessThanOrEqual(2);
  });
});
