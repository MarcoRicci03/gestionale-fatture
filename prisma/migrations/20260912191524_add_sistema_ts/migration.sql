-- CreateEnum
CREATE TYPE "StatoTs" AS ENUM ('DA_INVIARE', 'IN_TRASMISSIONE', 'INVIATA', 'DA_CANCELLARE_SU_TS', 'ANNULLATA_TS');

-- AlterTable
ALTER TABLE "pagamenti" ADD COLUMN     "bollo" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "data_invio_ts" TIMESTAMP(3),
ADD COLUMN     "flag_opposizione" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "id_TrasmissioneTs" INTEGER,
ADD COLUMN     "natura_iva" TEXT NOT NULL DEFAULT 'N2.2',
ADD COLUMN     "pagamento_tracciato" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "protocollo_cancellazione_ts" TEXT,
ADD COLUMN     "protocollo_ts" TEXT,
ADD COLUMN     "stato_ts" "StatoTs" NOT NULL DEFAULT 'DA_INVIARE';

-- CreateTable
CREATE TABLE "impostazioni_sistema_ts" (
    "id" SERIAL NOT NULL,
    "id_Utente" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "pincodeEncrypted" TEXT NOT NULL,
    "codiceRegione" TEXT DEFAULT '000',
    "codiceAsl" TEXT DEFAULT '000',
    "codiceStruttura" TEXT,
    "naturaIvaDefault" TEXT NOT NULL DEFAULT 'N2.2',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impostazioni_sistema_ts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trasmissioni_ts" (
    "id" SERIAL NOT NULL,
    "id_Utente" INTEGER NOT NULL,
    "protocollo" TEXT NOT NULL,
    "nomeFile" TEXT NOT NULL,
    "dataInvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statoElaborazione" TEXT,
    "codiceEsito" TEXT,
    "descrizioneEsito" TEXT,
    "numRicevuti" INTEGER,
    "numAccolti" INTEGER,
    "numScartati" INTEGER,
    "pdfRicevuta" BYTEA,
    "csvErrori" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trasmissioni_ts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "impostazioni_sistema_ts_id_Utente_key" ON "impostazioni_sistema_ts"("id_Utente");

-- CreateIndex
CREATE UNIQUE INDEX "trasmissioni_ts_protocollo_key" ON "trasmissioni_ts"("protocollo");

-- CreateIndex
CREATE INDEX "trasmissioni_ts_id_Utente_dataInvio_idx" ON "trasmissioni_ts"("id_Utente", "dataInvio");

-- CreateIndex
CREATE INDEX "pagamenti_id_Utente_stato_ts_idx" ON "pagamenti"("id_Utente", "stato_ts");

-- CreateIndex
CREATE INDEX "pagamenti_id_TrasmissioneTs_idx" ON "pagamenti"("id_TrasmissioneTs");

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_id_TrasmissioneTs_fkey" FOREIGN KEY ("id_TrasmissioneTs") REFERENCES "trasmissioni_ts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impostazioni_sistema_ts" ADD CONSTRAINT "impostazioni_sistema_ts_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trasmissioni_ts" ADD CONSTRAINT "trasmissioni_ts_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;
