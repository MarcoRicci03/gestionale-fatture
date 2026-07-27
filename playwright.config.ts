import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // I nuovi spec (invoices/export/payers) condividono lo stesso TEST_USER e
  // quindi la stessa numerazione fatture per anno (nessun retry su
  // collisione, vedi getNextInvoiceNumberForUserYear): un solo worker evita
  // la race tra file diversi eseguiti in parallelo.
  workers: 1,
  // Semina l'utente di test prima dell'intera suite (vedi e2e/global-setup.ts).
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
