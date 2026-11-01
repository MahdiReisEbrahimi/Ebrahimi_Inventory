-- Existing priced invoices retain their original payment and settlement data.
ALTER TABLE "Invoice" ADD COLUMN "saleType" TEXT NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleType_check" CHECK ("saleType" IN ('REGULAR', 'CREDIT'));
ALTER TABLE "InvoiceItem" ALTER COLUMN "unitPrice" DROP NOT NULL;
ALTER TABLE "InvoiceItem" ALTER COLUMN "total" DROP NOT NULL;
CREATE INDEX "Invoice_saleType_idx" ON "Invoice"("saleType");
