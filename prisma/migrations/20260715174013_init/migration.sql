-- CreateTable
CREATE TABLE "utenti" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT,
    "cognome" TEXT,
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
    "prezzo_totale" DOUBLE PRECISION NOT NULL,
    "mod_pag" TEXT NOT NULL,
    "sedute" INTEGER,
    "commento" TEXT,
    "n_fattura" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "mese" TEXT NOT NULL,
    "citta" TEXT NOT NULL,
    "cap" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "pagamenti_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "paganti_id_Utente_cf_key" ON "paganti"("id_Utente", "cf");

-- CreateIndex
CREATE UNIQUE INDEX "paganti_id_Utente_piva_key" ON "paganti"("id_Utente", "piva");

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
ALTER TABLE "sedute" ADD CONSTRAINT "sedute_id_Paziente_fkey" FOREIGN KEY ("id_Paziente") REFERENCES "pazienti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
