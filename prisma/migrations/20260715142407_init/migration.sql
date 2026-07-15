-- CreateTable
CREATE TABLE "utenti" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT,
    "cognome" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "abilitato" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "paganti" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_Utente" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "citta" TEXT NOT NULL,
    "cap" TEXT NOT NULL,
    "cf" TEXT,
    "piva" TEXT,
    "eliminato" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "paganti_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pazienti" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_Utente" INTEGER NOT NULL,
    "id_Pagante" INTEGER,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "eliminato" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "pazienti_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pazienti_id_Pagante_fkey" FOREIGN KEY ("id_Pagante") REFERENCES "paganti" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pagamenti" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_Utente" INTEGER NOT NULL,
    "id_Pagante" INTEGER NOT NULL,
    "id_Paziente" INTEGER NOT NULL,
    "prezzo_totale" REAL NOT NULL,
    "mod_pag" TEXT NOT NULL,
    "sedute" INTEGER,
    "commento" TEXT,
    "n_fattura" INTEGER NOT NULL,
    "data" DATETIME NOT NULL,
    "mese" TEXT NOT NULL,
    "citta" TEXT NOT NULL,
    "cap" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "pagamenti_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pagamenti_id_Pagante_fkey" FOREIGN KEY ("id_Pagante") REFERENCES "paganti" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pagamenti_id_Paziente_fkey" FOREIGN KEY ("id_Paziente") REFERENCES "pazienti" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sedute" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_Paziente" INTEGER NOT NULL,
    "prezzo" REAL NOT NULL,
    "data" DATETIME NOT NULL,
    "pagato" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "sedute_id_Paziente_fkey" FOREIGN KEY ("id_Paziente") REFERENCES "pazienti" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "utenti_username_key" ON "utenti"("username");

-- CreateIndex
CREATE UNIQUE INDEX "paganti_id_Utente_cf_key" ON "paganti"("id_Utente", "cf");

-- CreateIndex
CREATE UNIQUE INDEX "paganti_id_Utente_piva_key" ON "paganti"("id_Utente", "piva");
