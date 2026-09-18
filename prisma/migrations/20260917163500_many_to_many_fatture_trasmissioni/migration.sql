-- CreateTable
CREATE TABLE "_FattureTrasmissioni" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_FattureTrasmissioni_AB_unique" ON "_FattureTrasmissioni"("A", "B");

-- CreateIndex
CREATE INDEX "_FattureTrasmissioni_B_index" ON "_FattureTrasmissioni"("B");

-- AddForeignKey
ALTER TABLE "_FattureTrasmissioni" ADD CONSTRAINT "_FattureTrasmissioni_A_fkey" FOREIGN KEY ("A") REFERENCES "pagamenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FattureTrasmissioni" ADD CONSTRAINT "_FattureTrasmissioni_B_fkey" FOREIGN KEY ("B") REFERENCES "trasmissioni_ts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill data from existing id_TrasmissioneTs before dropping column
INSERT INTO "_FattureTrasmissioni" ("A", "B")
SELECT "id", "id_TrasmissioneTs"
FROM "pagamenti"
WHERE "id_TrasmissioneTs" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill data from existing cancellations (protocollo_cancellazione_ts)
INSERT INTO "_FattureTrasmissioni" ("A", "B")
SELECT p."id", t."id"
FROM "pagamenti" p
JOIN "trasmissioni_ts" t ON t."protocollo" = p."protocollo_cancellazione_ts"
ON CONFLICT DO NOTHING;

-- DropForeignKey
ALTER TABLE "pagamenti" DROP CONSTRAINT "pagamenti_id_TrasmissioneTs_fkey";

-- DropIndex
DROP INDEX IF EXISTS "pagamenti_id_TrasmissioneTs_idx";

-- AlterTable
ALTER TABLE "pagamenti" DROP COLUMN "id_TrasmissioneTs";
