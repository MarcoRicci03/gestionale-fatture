-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModalitaPagamento" AS ENUM ('CONTANTI', 'CARTA', 'BONIFICO');

-- CreateTable
CREATE TABLE "utenti" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT,
    "cognome" TEXT,
    "pIva" TEXT,
    "cf" TEXT,
    "via" TEXT,
    "citta" TEXT,
    "cap" TEXT,
    "provincia" TEXT,
    "titolo" TEXT,
    "specializzazione" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "abilitato" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paganti" (
    "id" SERIAL NOT NULL,
    "id_Utente" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "citta" TEXT NOT NULL,
    "cap" TEXT NOT NULL,
    "cf" TEXT,
    "piva" TEXT,
    "eliminato" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "paganti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pazienti" (
    "id" SERIAL NOT NULL,
    "id_Utente" INTEGER NOT NULL,
    "id_Pagante" INTEGER,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "eliminato" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pazienti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamenti" (
    "id" SERIAL NOT NULL,
    "id_Utente" INTEGER NOT NULL,
    "id_Pagante" INTEGER NOT NULL,
    "id_Paziente" INTEGER NOT NULL,
    "prezzo_totale" DECIMAL(10,2) NOT NULL,
    "mod_pag" "ModalitaPagamento" NOT NULL,
    "sedute" INTEGER,
    "commento" TEXT,
    "n_fattura" INTEGER NOT NULL,
    "anno" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "citta" TEXT NOT NULL,
    "cap" TEXT NOT NULL,
    "pdfLayoutSnapshot" JSONB,
    "bolloCodice" TEXT,

    CONSTRAINT "pagamenti_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "fattura_mesi" (
    "id" SERIAL NOT NULL,
    "id_Pagamento" INTEGER NOT NULL,
    "mese" TEXT NOT NULL,
    "prezzo" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "fattura_mesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sedute" (
    "id" SERIAL NOT NULL,
    "id_Paziente" INTEGER NOT NULL,
    "prezzo" DOUBLE PRECISION NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "pagato" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sedute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utenti_username_key" ON "utenti"("username");

-- CreateIndex
CREATE INDEX "paganti_id_Utente_eliminato_idx" ON "paganti"("id_Utente", "eliminato");

-- Indici unique parziali non rappresentabili con @@unique nel DSL di Prisma
-- (vedi commento sul model Pagante in schema.prisma): cf/piva sono univoci
-- per utente SOLO tra i paganti attivi (eliminato = false). `prisma migrate
-- diff`/`migrate dev` non li generano automaticamente dallo schema: se in
-- futuro si rigenera questa migration, vanno riaggiunti a mano.
CREATE UNIQUE INDEX "paganti_id_Utente_cf_key" ON "paganti"("id_Utente", "cf") WHERE "eliminato" = false;
CREATE UNIQUE INDEX "paganti_id_Utente_piva_key" ON "paganti"("id_Utente", "piva") WHERE "eliminato" = false;

-- CreateIndex
CREATE INDEX "pazienti_id_Utente_eliminato_idx" ON "pazienti"("id_Utente", "eliminato");

-- CreateIndex
CREATE UNIQUE INDEX "pagamenti_bolloCodice_key" ON "pagamenti"("bolloCodice");

-- CreateIndex
CREATE INDEX "pagamenti_id_Utente_data_idx" ON "pagamenti"("id_Utente", "data");

-- CreateIndex
CREATE UNIQUE INDEX "pagamenti_id_Utente_n_fattura_anno_key" ON "pagamenti"("id_Utente", "n_fattura", "anno");

-- CreateIndex
CREATE UNIQUE INDEX "impostazioni_pdf_id_Utente_key" ON "impostazioni_pdf"("id_Utente");

-- CreateIndex
CREATE UNIQUE INDEX "fattura_mesi_id_Pagamento_mese_key" ON "fattura_mesi"("id_Pagamento", "mese");

-- AddForeignKey
ALTER TABLE "paganti" ADD CONSTRAINT "paganti_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pazienti" ADD CONSTRAINT "pazienti_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pazienti" ADD CONSTRAINT "pazienti_id_Pagante_fkey" FOREIGN KEY ("id_Pagante") REFERENCES "paganti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_id_Pagante_fkey" FOREIGN KEY ("id_Pagante") REFERENCES "paganti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_id_Paziente_fkey" FOREIGN KEY ("id_Paziente") REFERENCES "pazienti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impostazioni_pdf" ADD CONSTRAINT "impostazioni_pdf_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fattura_mesi" ADD CONSTRAINT "fattura_mesi_id_Pagamento_fkey" FOREIGN KEY ("id_Pagamento") REFERENCES "pagamenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sedute" ADD CONSTRAINT "sedute_id_Paziente_fkey" FOREIGN KEY ("id_Paziente") REFERENCES "pazienti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

