-- DropForeignKey
ALTER TABLE "impostazioni_pdf" DROP CONSTRAINT "impostazioni_pdf_id_Utente_fkey";

-- AddForeignKey
ALTER TABLE "impostazioni_pdf" ADD CONSTRAINT "impostazioni_pdf_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
