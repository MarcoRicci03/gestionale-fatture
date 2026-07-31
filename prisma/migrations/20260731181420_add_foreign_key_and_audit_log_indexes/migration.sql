-- DB-01: Postgres non crea automaticamente un indice sulle colonne di una
-- foreign key. pazienti.id_Pagante e pagamenti.id_Pagante/id_Paziente sono
-- interrogate spesso (cascata archivePayer/restorePayer, groupBy in
-- getArchivedPayers/getArchivedPatients, count in hardDeletePayer/
-- hardDeletePatient) e verificate dal database stesso a ogni
-- ON DELETE CASCADE/RESTRICT.
-- CreateIndex
CREATE INDEX "pazienti_id_Pagante_idx" ON "pazienti"("id_Pagante");

-- CreateIndex
CREATE INDEX "pagamenti_id_Pagante_idx" ON "pagamenti"("id_Pagante");

-- CreateIndex
CREATE INDEX "pagamenti_id_Paziente_idx" ON "pagamenti"("id_Paziente");

-- DB-02: gli indici esistenti su audit_logs hanno createdAt in seconda
-- posizione (id_Utente, createdAt) / (azione, createdAt): nessuno dei due è
-- utilizzabile per un predicato che filtra solo su createdAt, usato sia dal
-- DELETE settimanale di retention (scripts/audit-log-retention.mjs) sia da
-- un filtro data-only lato server (lib/audit/list-query.ts).
-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
