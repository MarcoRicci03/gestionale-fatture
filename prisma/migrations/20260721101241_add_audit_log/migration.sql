-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "id_Utente" INTEGER,
    "azione" TEXT NOT NULL,
    "entita" TEXT,
    "entitaId" INTEGER,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_id_Utente_createdAt_idx" ON "audit_logs"("id_Utente", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_azione_createdAt_idx" ON "audit_logs"("azione", "createdAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_id_Utente_fkey" FOREIGN KEY ("id_Utente") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;
