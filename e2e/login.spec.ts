import { test, expect } from "@playwright/test";
import { TEST_USER } from "./fixtures/test-user";

test("login riuscito reindirizza alla dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(TEST_USER.username);
  await page.getByLabel("Password").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("credenziali errate mostrano un messaggio d'errore", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(TEST_USER.username);
  await page.getByLabel("Password").fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();
  // getByRole("alert") da solo matcha anche il route-announcer che Next.js
  // inietta in ogni pagina (id="__next-route-announcer__", anch'esso
  // role="alert"): il filtro sul testo disambigua senza perdere la semantica.
  await expect(
    page.getByRole("alert").filter({ hasText: "Credenziali non valide" })
  ).toBeVisible();
});
