# Piano di implementazione della suite di test

Stack scelto:

- **Vitest + React Testing Library (RTL)** — unit test (logica di business, funzioni pure) e component test (Client Components).
- **Playwright** — test End-to-End su pagine, routing e Server Actions.

Package manager del progetto: **npm** (presente solo `package-lock.json`). Contesto: Next 16.2.10, React 19.2.4, TypeScript strict, path alias `@/*` → root. Attualmente **non esiste un test runner**: le uniche verifiche sono script `tsx` ad-hoc in `scripts/verify-*.ts`.

> **Regola d'ordine:** eseguire prima la sezione 1 (dipendenze), poi la 2 (config), infine creare i file di test della sezione 4.

---

## 1. Dipendenze

```bash
# Unit / component testing (Vitest + RTL)
npm install -D vitest @vitejs/plugin-react jsdom vite-tsconfig-paths \
  @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event

# E2E (Playwright)
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

Perché queste:

- `vite-tsconfig-paths` — risolve l'alias `@/*` di `tsconfig.json` dentro Vitest (senza, gli import `@/lib/...` non vengono trovati).
- `@vitejs/plugin-react` — trasforma JSX / abilita React nei component test.
- `jsdom` — l'ambiente DOM per RTL (allineato alla guida Vitest della documentazione Next.js).
- `@testing-library/react` v16 è compatibile con React 19.
- `npx playwright install` scarica il browser (qui solo Chromium per partire leggeri).

---

## 2. Configurazione

### `vitest.config.ts` (root)

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Playwright ha il proprio runner: Vitest non deve raccogliere gli spec E2E.
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
```

### `vitest.setup.ts` (root)

```ts
// Aggiunge i matcher DOM (toBeInTheDocument, ecc.) a expect di Vitest.
import "@testing-library/jest-dom/vitest";
```

### `playwright.config.ts` (root)

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Semina l'utente di test prima dell'intera suite (vedi sezione 4).
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
```

### `package.json` — script da aggiungere

```jsonc
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### Altri accorgimenti

- `tsconfig.json`: nessuna modifica obbligatoria. Con `globals: true` i globali di Vitest sono già disponibili; opzionalmente si può aggiungere `"vitest/globals"` a `compilerOptions.types` per l'autocompletamento dei tipi.
- `.gitignore`: aggiungere `/test-results`, `/playwright-report`, `/.playwright`.

---

## 3. Target iniziali (perché questi)

### Primo unit test → `lib/validations/invoice.ts` (`invoiceSchema`)

È lo schema Zod con la logica di business più densa del codebase ed è **puro** (nessun DOM, nessun DB): parsing del prezzo con virgola decimale italiana (`PREZZO_REGEX`), soglia della marca da bollo (`superRefine` su `SOGLIA_BOLLO = 77.47` da `lib/constants/bollo.ts`), unicità e limiti dei mesi, arrotondamento via `roundCurrency` (`lib/utils/currency.ts`). Consolida in Vitest ciò che oggi vive negli script `scripts/verify-currency-rounding.ts` e `scripts/verify-invoice-bollo-threshold.ts`.

### Esempio component test (RTL, secondario) → `components/auth/login-form.tsx`

Client Component minimale (`useActionState` + `useFormStatus`). Dimostra il setup jsdom + Testing Library. **Attenzione:** importa la Server Action `login` da `@/lib/actions/auth`, che a sua volta trascina `prisma`, bcrypt, rate-limit e audit → in un component test va **mockata** con `vi.mock`.

### Primo test E2E → flusso di login completo (`/login` → submit → `/dashboard`)

`app/login/page.tsx` renderizza `<LoginForm>`; il submit invoca la Server Action `login` (`lib/actions/auth.ts`) che, su successo, imposta il cookie di sessione e fa `redirect("/dashboard")`. Testa insieme pagina, Server Action, sessione e route protection (`proxy.ts`). Richiede un DB reale con un utente seed (vedi sezione 4/5).

---

## 4. Codice di partenza

### `lib/validations/invoice.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { invoiceSchema } from "@/lib/validations/invoice";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";

const base = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: "2026-01-01",
  mod_pag: "CONTANTI" as const,
  n_fattura: 1,
  citta: "Roma",
  cap: "00100",
};

describe("invoiceSchema", () => {
  it("accetta una fattura valida sotto soglia bollo", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      mesi: [{ mese: "GENNAIO", prezzo: "50,00" }], // virgola decimale IT
      bolloCodice: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mesi[0].prezzo).toBe(50);
  });

  it("richiede il codice bollo quando il totale supera la soglia", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      mesi: [{ mese: "GENNAIO", prezzo: String(SOGLIA_BOLLO + 1) }],
      bolloCodice: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("bolloCodice"))).toBe(true);
    }
  });

  it("rifiuta un prezzo non numerico invece di degradarlo a 0", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      mesi: [{ mese: "GENNAIO", prezzo: "abc" }],
    });
    expect(r.success).toBe(false);
  });

  it("rifiuta mesi duplicati", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      mesi: [
        { mese: "GENNAIO", prezzo: "10" },
        { mese: "GENNAIO", prezzo: "10" },
      ],
    });
    expect(r.success).toBe(false);
  });
});
```

### `components/auth/login-form.test.tsx` (esempio RTL secondario)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "@/components/auth/login-form";

// La Server Action trascina prisma/bcrypt/audit: va mockata nel component test.
vi.mock("@/lib/actions/auth", () => ({ login: vi.fn(async () => ({})) }));

describe("LoginForm", () => {
  it("mostra i campi username e password e il pulsante Accedi", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accedi" })).toBeInTheDocument();
  });
});
```

### `e2e/fixtures/test-user.ts`

```ts
export const TEST_USER = { username: "e2e_test", password: "E2ePassw0rd!" };
```

### `e2e/global-setup.ts` — seed idempotente dell'utente

Nel modello `Utente` (`prisma/schema.prisma`) gli unici campi obbligatori sono `username` e `passwordHash` (tutti gli altri sono opzionali o hanno un default: `abilitato = true`, `tokenVersion = 0`, `isAdmin = false`).

```ts
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { TEST_USER } from "./fixtures/test-user";

export default async function globalSetup() {
  const passwordHash = await hashPassword(TEST_USER.password);
  await prisma.utente.upsert({
    where: { username: TEST_USER.username },
    update: { passwordHash, abilitato: true },
    create: { username: TEST_USER.username, passwordHash },
  });
}
```

### `e2e/login.spec.ts`

```ts
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
  await expect(page.getByRole("alert")).toHaveText(/Credenziali non valide/);
});
```

> **Nota rate-limit:** `checkLoginRateLimit` (`lib/auth/rate-limit.ts`) è in-memory su `username+ip` e concede il primo tentativo → la happy-path passa senza tuning. Se in futuro si aggiungono molti test di login *falliti* in sequenza, isolarli o resettare il limiter tra i test per evitare falsi negativi.

---

## 5. Prerequisiti d'ambiente per l'E2E

- Postgres attivo: `docker compose -f docker-compose.dev.yml up -d`, schema applicato con `npx prisma migrate dev`.
- `.env` valorizzato con `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
- Il `webServer` di Playwright avvia `npm run dev` e il `globalSetup` semina l'utente prima della suite. In CI: usare `npm run build` + `npm run start` al posto di `npm run dev`.

---

## Verifica (dopo l'implementazione)

1. `npm run test` → i 4 casi di `invoiceSchema` passano.
2. `npm run test:watch` → modalità watch attiva; il component test `LoginForm` renderizza in jsdom.
3. Con Postgres up + `.env` valido: `npm run test:e2e` → i due spec di login passano (redirect a `/dashboard` e messaggio d'errore).
4. `npx tsc --noEmit` resta pulito.
5. `npm run lint` non segnala i nuovi file.

---

## Fuori scope (per un secondo momento)

Soglie di coverage, workflow CI, test su tutti gli altri form/manager, migrazione completa degli script `scripts/verify-*.ts` in Vitest. Da valutare una volta consolidata questa base.
