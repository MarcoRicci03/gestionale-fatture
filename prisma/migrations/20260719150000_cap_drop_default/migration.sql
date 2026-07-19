-- Rimuove il default "" su pagamenti.cap: il campo è sempre valorizzato
-- dall'applicazione (validazione Zod obbligatoria in lib/validations/invoice.ts),
-- il default non veniva mai realmente usato ed era un sentinella ambiguo di
-- "assente" al posto di NULL.
ALTER TABLE "pagamenti" ALTER COLUMN "cap" DROP DEFAULT;
