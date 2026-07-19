-- DropIndex
DROP INDEX "paganti_id_Utente_cf_key";

-- DropIndex
DROP INDEX "paganti_id_Utente_piva_key";

-- Le colonne cf/piva di "paganti" usano soft-delete (eliminato), ma i
-- vincoli unique(id_Utente, cf)/unique(id_Utente, piva) generati da
-- @@unique in schema.prisma includevano anche le righe soft-deleted:
-- reinserire un pagante con lo stesso CF/PIVA di uno eliminato falliva con
-- un P2002 nonostante il controllo applicativo (checkPayerUniqueTaxIds,
-- lib/actions/payers.ts) lo permettesse. Sostituiamo gli indici pieni con
-- indici unique parziali che ignorano le righe eliminato = true.
CREATE UNIQUE INDEX "paganti_id_Utente_cf_key" ON "paganti"("id_Utente", "cf") WHERE "eliminato" = false;
CREATE UNIQUE INDEX "paganti_id_Utente_piva_key" ON "paganti"("id_Utente", "piva") WHERE "eliminato" = false;
