-- Converte gli importi da DOUBLE PRECISION a NUMERIC(10,2) per eliminare gli errori
-- di arrotondamento binario sulle somme (vedi drift già corretto in
-- 20260717120000_fattura_mesi_prezzo). ROUND(...::numeric, 2) converte i valori
-- esistenti e pulisce come effetto collaterale eventuali residui di drift.
ALTER TABLE "pagamenti" ALTER COLUMN "prezzo_totale" TYPE NUMERIC(10,2) USING ROUND(prezzo_totale::numeric, 2);
ALTER TABLE "fattura_mesi" ALTER COLUMN "prezzo" TYPE NUMERIC(10,2) USING ROUND(prezzo::numeric, 2);
