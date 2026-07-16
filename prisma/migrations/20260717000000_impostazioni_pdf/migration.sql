-- CreateTable
CREATE TABLE "impostazioni_pdf" (
    "id" SERIAL NOT NULL,
    "id_Utente" INTEGER NOT NULL,
    "pageWidth" INTEGER NOT NULL DEFAULT 595,
    "pageHeight" INTEGER NOT NULL DEFAULT 842,
    "marginTop" INTEGER NOT NULL DEFAULT 40,
    "marginRight" INTEGER NOT NULL DEFAULT 40,
    "marginBottom" INTEGER NOT NULL DEFAULT 40,
    "marginLeft" INTEGER NOT NULL DEFAULT 40,
    "fontFamily" TEXT NOT NULL DEFAULT 'Helvetica',
    "fontSizeBase" INTEGER NOT NULL DEFAULT 11,
    "blocchi" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impostazioni_pdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "impostazioni_pdf_id_Utente_key" ON "impostazioni_pdf"("id_Utente");

-- AddForeignKey
ALTER TABLE "impostazioni_pdf" ADD CONSTRAINT "impostazioni_pdf_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "pagamenti" ADD COLUMN "pdfLayoutSnapshot" JSONB;
