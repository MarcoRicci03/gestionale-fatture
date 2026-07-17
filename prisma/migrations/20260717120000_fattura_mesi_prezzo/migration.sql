-- Aggiunge la colonna "prezzo" alla tabella "fattura_mesi" (NOT NULL con default 0).
-- IF NOT EXISTS rende l'ALTER idempotente in caso di ri-esecuzione dopo un fallimento
-- della successiva UPDATE (la colonna viene creata prima che la transazione fallisca).
ALTER TABLE "fattura_mesi" ADD COLUMN IF NOT EXISTS "prezzo" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Distribuisce il prezzo_totale di ogni fattura in parti uguali tra i mesi collegati.
-- L'eventuale resto (differenza di centesimi dovuta all'arrotondamento) viene
-- assegnato all'ultimo mese (per id) di ciascuna fattura, in modo che la somma
-- dei prezzi dei mesi coincida esattamente con il prezzo_totale originale.
WITH calcolato AS (
  SELECT
    fm.id,
    fm."id_Pagamento",
    p.prezzo_totale,
    COUNT(*) OVER (PARTITION BY fm."id_Pagamento") AS n_mesi,
    ROW_NUMBER() OVER (PARTITION BY fm."id_Pagamento" ORDER BY fm.id) AS rn
  FROM "fattura_mesi" fm
  JOIN "pagamenti" p ON p.id = fm."id_Pagamento"
),
distribuito AS (
  SELECT
    id,
    "id_Pagamento",
    prezzo_totale,
    n_mesi,
    rn,
    -- base in centesimi (intera), distribuita in parti uguali
    (prezzo_totale * 100.0) / n_mesi AS base_centesimi_reale,
    FLOOR((prezzo_totale * 100.0) / n_mesi) AS base_centesimi,
    -- resto in centesimi da distribuire
    (prezzo_totale * 100.0) - FLOOR((prezzo_totale * 100.0) / n_mesi) * n_mesi AS resto_centesimi
  FROM calcolato
)
UPDATE "fattura_mesi" SET "prezzo" = (
  SELECT
    CASE
      -- ultimo mese (rn = n_mesi): base + resto
      WHEN d.rn = d.n_mesi THEN (d.base_centesimi + d.resto_centesimi) / 100.0
      -- altri mesi: solo base
      ELSE d.base_centesimi / 100.0
    END
  FROM distribuito d
  WHERE d.id = "fattura_mesi".id
);
