import { expect, type Page } from "@playwright/test";
import { TEST_USER, type E2eUser } from "./test-user";

export async function loginAs(page: Page, user: { username: string; password: string }): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function loginAsTestUser(page: Page, user: E2eUser = TEST_USER): Promise<void> {
  await loginAs(page, user);
}
