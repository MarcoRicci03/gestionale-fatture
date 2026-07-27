import { expect, type Page } from "@playwright/test";
import { TEST_USER } from "./test-user";

export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Username").fill(TEST_USER.username);
  await page.getByLabel("Password").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
