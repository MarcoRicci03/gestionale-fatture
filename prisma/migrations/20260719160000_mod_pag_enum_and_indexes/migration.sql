-- mod_pag: da String libera a enum Postgres. I valori esistenti sono già
-- esattamente CONTANTI/CARTA/BONIFICO (validati da Zod lato action), cast sicuro.
CREATE TYPE "ModalitaPagamento" AS ENUM ('CONTANTI', 'CARTA', 'BONIFICO');
ALTER TABLE "pagamenti" ALTER COLUMN "mod_pag" TYPE "ModalitaPagamento" USING "mod_pag"::"ModalitaPagamento";

-- Indici sulle colonne filtrate sistematicamente da lib/data/*.ts
-- (id_Utente + eliminato per Pagante/Paziente, id_Utente + data per Pagamento).
CREATE INDEX IF NOT EXISTS "paganti_id_Utente_eliminato_idx" ON "paganti" ("id_Utente", "eliminato");
CREATE INDEX IF NOT EXISTS "pazienti_id_Utente_eliminato_idx" ON "pazienti" ("id_Utente", "eliminato");
CREATE INDEX IF NOT EXISTS "pagamenti_id_Utente_data_idx" ON "pagamenti" ("id_Utente", "data");
