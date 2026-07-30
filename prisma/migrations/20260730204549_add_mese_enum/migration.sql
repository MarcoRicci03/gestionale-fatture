-- CreateEnum
CREATE TYPE "Mese" AS ENUM ('GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE');

-- AlterTable
-- Cast esplicito invece del DROP+ADD generato di default da `prisma migrate
-- dev` (che avrebbe cancellato tutte le righe esistenti): i valori sono già
-- tutti maiuscoli e coincidono esattamente con le 12 etichette dell'enum
-- (normalizzati in una sessione precedente), quindi la conversione riuscirà
-- senza perdita di dati. L'indice unique su (id_Pagamento, mese) creato dalla
-- migration iniziale resta valido, non va ricreato: ALTER COLUMN ... TYPE non
-- tocca gli indici esistenti sulla colonna.
ALTER TABLE "fattura_mesi" ALTER COLUMN "mese" TYPE "Mese" USING ("mese"::"Mese");
