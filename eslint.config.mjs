import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktree/harness dir: può contenere una copia completa del repo.
    ".claude/**",
    // Cartella dati bind mount Postgres locale (può avere permessi root/postgres):
    "postgres_dev_data/**",
  ]),
]);

export default eslintConfig;
