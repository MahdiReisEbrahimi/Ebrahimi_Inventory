CREATE TABLE "Buyer" (
  "id" SERIAL NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "nationalId" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Invoice" ADD COLUMN "customerId" INTEGER;
CREATE UNIQUE INDEX "Buyer_nationalId_key" ON "Buyer"("nationalId");
CREATE INDEX "Buyer_lastName_firstName_idx" ON "Buyer"("lastName", "firstName");
CREATE INDEX "Invoice_customerId_createdAt_idx" ON "Invoice"("customerId", "createdAt");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
