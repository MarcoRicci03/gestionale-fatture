-- Aggiunge la colonna "anno" (anno solare, mantenuto in sync dall'applicazione
-- ad ogni scrittura di una fattura) e un vincolo di unicità DB-level su
-- (id_Utente, n_fattura, anno). Chiude la race condition del check-then-insert
-- applicativo in isInvoiceNumberTaken (lib/actions/invoices.ts): prima d'ora
-- due richieste concorrenti potevano creare due fatture con lo stesso numero
-- nello stesso anno.
ALTER TABLE "pagamenti" ADD COLUMN IF NOT EXISTS "anno" INTEGER;

UPDATE "pagamenti" SET "anno" = EXTRACT(YEAR FROM "data")::integer WHERE "anno" IS NULL;

ALTER TABLE "pagamenti" ALTER COLUMN "anno" SET NOT NULL;

ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_id_Utente_n_fattura_anno_key" UNIQUE ("id_Utente", "n_fattura", "anno");
