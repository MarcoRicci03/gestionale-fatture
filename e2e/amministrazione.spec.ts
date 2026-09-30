import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { loginAs, loginAsTestUser } from "./fixtures/login";
import { TEST_ADMIN, TEST_USER } from "./fixtures/test-user";
import { uniqueSuffix } from "./fixtures/prisma-test-fixtures";

test.describe("amministrazione", () => {
  test("un utente creato dall'admin entra con password temporanea e deve cambiarla", async ({ page, browser }) => {
    const suffix = uniqueSuffix();
    const username = `e2e_nuovo_${suffix}`;
    const nome = `E2ENuovo${suffix}`;
    const passwordTemporanea = "E2eTemporanea-Passw0rd!";
    const passwordScelta = "E2eScelta-Passw0rd!2";

    try {
      // L'admin crea l'utente dalla pagina /users.
      await loginAs(page, TEST_ADMIN);
      await page.goto("/users");
      await page.getByRole("button", { name: "Nuovo utente" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Username", { exact: true }).fill(username);
      await dialog.getByLabel("Nome", { exact: true }).fill(nome);
      await dialog.getByLabel("Cognome").fill("Amministrazione");
      await dialog.getByLabel("Password", { exact: true }).fill(passwordTemporanea);
      await dialog.getByRole("button", { name: "Crea utente" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator("tbody tr", { hasText: nome })).toBeVisible();

      // La creazione compare nell'audit log, attribuita all'admin.
      await page.goto(`/audit-log?utente=${TEST_ADMIN.username}&azione=user.create`);
      await expect(page.locator("tbody tr", { hasText: username })).toBeVisible();

      // Il nuovo utente entra e vede l'avviso di password temporanea.
      const paginaUtente = await (await browser.newContext()).newPage();
      await loginAs(paginaUtente, { username, password: passwordTemporanea });
      const avviso = paginaUtente.getByText(/Stai usando una password temporanea/);
      await expect(avviso).toBeVisible();

      // Dopo aver scelto la propria password l'avviso sparisce.
      await paginaUtente.goto("/account");
      await paginaUtente.getByLabel("Password attuale").fill(passwordTemporanea);
      await paginaUtente.getByLabel("Nuova password", { exact: true }).fill(passwordScelta);
      await paginaUtente.getByLabel("Conferma nuova password").fill(passwordScelta);
      await paginaUtente.getByRole("button", { name: "Cambia password" }).click();
      await expect(paginaUtente.getByText("Password aggiornata con successo")).toBeVisible();
      await paginaUtente.goto("/dashboard");
      await expect(avviso).toHaveCount(0);
    } finally {
      // Le righe dell'audit restano, con id_Utente a NULL (ON DELETE SET NULL).
      await prisma.utente.deleteMany({ where: { username } });
    }
  });

  test("un utente non amministratore non raggiunge utenti e audit log", async ({ page }) => {
    await loginAsTestUser(page, TEST_USER);

    await page.goto("/users");
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/audit-log");
    await expect(page).toHaveURL(/\/dashboard/);

    // E il menu non glieli mostra.
    await expect(page.getByRole("link", { name: "Utenti" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
  });
});
