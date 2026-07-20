/*
  Warnings:

  - You are about to drop the `sedute` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sedute" DROP CONSTRAINT "sedute_id_Paziente_fkey";

-- DropTable
DROP TABLE "sedute";
