-- AlterTable
ALTER TABLE "_FattureTrasmissioni" ADD CONSTRAINT "_FattureTrasmissioni_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_FattureTrasmissioni_AB_unique";
