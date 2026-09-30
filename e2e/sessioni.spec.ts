import { test, expect, type Browser, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/login";
import { TEST_ADMIN } from "./fixtures/test-user";
import { createTempUser, deleteTempUser, uniqueSuffix } from "./fixtures/prisma-test-fixtures";

// Revoca delle sessioni (SEC-08, tokenVersion): una sessione già aperta
// smette di valere quando l'account viene disabilitato o la password cambia.
// Ogni test usa un utente usa e getta, perché ne modifica stato o password.

const PASSWORD = "E2eSessione-Passw0rd!";

async function nuovaPagina(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

test.describe("revoca delle sessioni", () => {
  test("un utente disabilitato dall'admin perde la sessione aperta", async ({ browser }) => {
    const suffix = uniqueSuffix();
    const utente = await createTempUser(suffix, PASSWORD);
    try {
      const paginaUtente = await nuovaPagina(browser);
      await loginAs(paginaUtente, { username: utente.username, password: PASSWORD });

      const paginaAdmin = await nuovaPagina(browser);
      await loginAs(paginaAdmin, TEST_ADMIN);
      await paginaAdmin.goto("/users");
      const riga = paginaAdmin.locator("tbody tr", { hasText: utente.nome! });
      await riga.getByRole("button", { name: "Disabilita" }).click();
      await expect(riga.getByText("Disabilitato")).toBeVisible();

      // La sessione dell'utente, aperta prima, non vale più.
      await paginaUtente.goto("/dashboard");
      await expect(paginaUtente).toHaveURL(/\/login/);

      // E non può rientrare.
      await paginaUtente.getByLabel("Username").fill(utente.username);
      await paginaUtente.getByLabel("Password").fill(PASSWORD);
      await paginaUtente.getByRole("button", { name: "Accedi" }).click();
      await expect(paginaUtente.getByText("Credenziali non valide")).toBeVisible();
    } finally {
      await deleteTempUser(utente.id);
    }
  });

  test("dopo il cambio password le altre sessioni vengono chiuse, quella corrente resta", async ({ browser }) => {
    const suffix = uniqueSuffix();
    const utente = await createTempUser(suffix, PASSWORD);
    const nuovaPassword = "E2eNuova-Passw0rd!2";
    try {
      const sessioneCorrente = await nuovaPagina(browser);
      const altraSessione = await nuovaPagina(browser);
      await loginAs(sessioneCorrente, { username: utente.username, password: PASSWORD });
      await loginAs(altraSessione, { username: utente.username, password: PASSWORD });

      await sessioneCorrente.goto("/account");
      await sessioneCorrente.getByLabel("Password attuale").fill(PASSWORD);
      await sessioneCorrente.getByLabel("Nuova password", { exact: true }).fill(nuovaPassword);
      await sessioneCorrente.getByLabel("Conferma nuova password").fill(nuovaPassword);
      await sessioneCorrente.getByRole("button", { name: "Cambia password" }).click();
      await expect(sessioneCorrente.getByText("Password aggiornata con successo")).toBeVisible();

      // L'altra sessione, firmata con la vecchia tokenVersion, è revocata.
      await altraSessione.goto("/dashboard");
      await expect(altraSessione).toHaveURL(/\/login/);

      // La sessione che ha cambiato la password resta valida.
      await sessioneCorrente.goto("/dashboard");
      await expect(sessioneCorrente).toHaveURL(/\/dashboard/);

      // La nuova password funziona.
      await loginAs(altraSessione, { username: utente.username, password: nuovaPassword });
    } finally {
      await deleteTempUser(utente.id);
    }
  });
});
