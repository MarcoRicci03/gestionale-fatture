-- Aggiunge la colonna "bolloCodice" (codice a 14 cifre della marca da bollo fisica
-- applicata alle fatture con importo superiore a € 77,47). Nullable: le fatture
-- esistenti restano NULL, nessun backfill necessario.
-- IF NOT EXISTS rende l'ALTER idempotente in caso di ri-esecuzione dopo un fallimento.
ALTER TABLE "pagamenti" ADD COLUMN IF NOT EXISTS "bolloCodice" TEXT;

-- Vincolo di unicità globale (non per utente): ogni marca da bollo fisica è
-- identificata da un codice univoco a livello nazionale, quindi non deve poter
-- essere riutilizzata su più fatture nel sistema. Postgres tratta i NULL come
-- non collidenti fra loro, quindi più fatture senza codice coesistono senza problemi.
CREATE UNIQUE INDEX IF NOT EXISTS "pagamenti_bolloCodice_key" ON "pagamenti"("bolloCodice");
