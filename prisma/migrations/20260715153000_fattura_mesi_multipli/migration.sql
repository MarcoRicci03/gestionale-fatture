-- CreateTable
CREATE TABLE "fattura_mesi" (
    "id" SERIAL NOT NULL,
    "id_Pagamento" INTEGER NOT NULL,
    "mese" TEXT NOT NULL,

    CONSTRAINT "fattura_mesi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fattura_mesi_id_Pagamento_mese_key" ON "fattura_mesi"("id_Pagamento", "mese");

-- AddForeignKey
ALTER TABLE "fattura_mesi" ADD CONSTRAINT "fattura_mesi_id_Pagamento_fkey" FOREIGN KEY ("id_Pagamento") REFERENCES "pagamenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing month data
INSERT INTO "fattura_mesi" ("id_Pagamento", "mese")
SELECT "id", "mese" FROM "pagamenti" WHERE "mese" IS NOT NULL AND "mese" <> '';

-- DropColumn
ALTER TABLE "pagamenti" DROP COLUMN "mese";
