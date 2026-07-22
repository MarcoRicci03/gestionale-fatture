-- Cambia pazienti.id_Pagante da ON DELETE SET NULL a ON DELETE CASCADE.
--
-- Contesto: Pagante/Paziente passano da "eliminato" (soft-delete puro) ad
-- "archiviato" (rename via @map, nessun DDL per quello). Con l'introduzione
-- dell'hard-delete condizionale (hardDeletePayer in lib/actions/payers.ts),
-- un pagante può essere cancellato definitivamente solo quando non ha più
-- fatture collegate (dirette o dei suoi pazienti) né pazienti ancora non
-- archiviati (guard applicativo, vedi lib/archive/guards.ts). A quel punto
-- gli unici pazienti che restano collegati sono già archiviati e senza
-- fatture: è corretto cancellarli a cascata invece di lasciarli con un
-- id_Pagante spezzato via SET NULL.
ALTER TABLE "pazienti" DROP CONSTRAINT "pazienti_id_Pagante_fkey";
ALTER TABLE "pazienti" ADD CONSTRAINT "pazienti_id_Pagante_fkey"
  FOREIGN KEY ("id_Pagante") REFERENCES "paganti"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
