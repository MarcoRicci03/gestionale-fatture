-- DropForeignKey
ALTER TABLE "pagamenti" DROP CONSTRAINT "pagamenti_id_Pagante_fkey";

-- DropForeignKey
ALTER TABLE "pagamenti" DROP CONSTRAINT "pagamenti_id_Paziente_fkey";

-- DropForeignKey
ALTER TABLE "pazienti" DROP CONSTRAINT "pazienti_id_Pagante_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "paganti_id_id_Utente_key" ON "paganti"("id", "id_Utente");

-- CreateIndex
CREATE UNIQUE INDEX "pazienti_id_id_Utente_key" ON "pazienti"("id", "id_Utente");

-- AddForeignKey
ALTER TABLE "pazienti" ADD CONSTRAINT "pazienti_id_Pagante_id_Utente_fkey" FOREIGN KEY ("id_Pagante", "id_Utente") REFERENCES "paganti"("id", "id_Utente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_id_Pagante_id_Utente_fkey" FOREIGN KEY ("id_Pagante", "id_Utente") REFERENCES "paganti"("id", "id_Utente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_id_Paziente_id_Utente_fkey" FOREIGN KEY ("id_Paziente", "id_Utente") REFERENCES "pazienti"("id", "id_Utente") ON DELETE RESTRICT ON UPDATE CASCADE;

