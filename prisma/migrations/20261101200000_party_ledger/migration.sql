-- Existing accounting tables from the incomplete foundation are deliberately preserved.
ALTER TABLE "Invoice" ADD COLUMN "accountChargeRial" DECIMAL(18,0),
 ADD COLUMN "accountReturnedRial" DECIMAL(18,0) NOT NULL DEFAULT 0;
CREATE TABLE "PartyLedgerEntry" (
 "id" SERIAL PRIMARY KEY, "buyerId" INTEGER NOT NULL,
 "invoiceId" INTEGER, "action" TEXT NOT NULL, "description" TEXT NOT NULL,
 "amountRial" DECIMAL(18,0) NOT NULL, "cashDirection" TEXT, "requestKey" TEXT,
 "details" JSONB, "historical" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PartyLedgerEntry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE,
 CONSTRAINT "PartyLedgerEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE,
 CONSTRAINT "PartyLedgerEntry_integer_amount" CHECK ("amountRial" = trunc("amountRial"))
);
CREATE UNIQUE INDEX "PartyLedgerEntry_requestKey_key" ON "PartyLedgerEntry"("requestKey");
CREATE INDEX "PartyLedgerEntry_buyerId_createdAt_id_idx" ON "PartyLedgerEntry"("buyerId", "createdAt", "id");
CREATE INDEX "PartyLedgerEntry_invoiceId_createdAt_id_idx" ON "PartyLedgerEntry"("invoiceId", "createdAt", "id");
