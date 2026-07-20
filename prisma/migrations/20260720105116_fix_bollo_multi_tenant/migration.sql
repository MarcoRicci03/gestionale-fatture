/*
  Warnings:

  - A unique constraint covering the columns `[id_Utente,bolloCodice]` on the table `pagamenti` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "pagamenti_bolloCodice_key";

-- CreateIndex
CREATE UNIQUE INDEX "pagamenti_id_Utente_bolloCodice_key" ON "pagamenti"("id_Utente", "bolloCodice");
