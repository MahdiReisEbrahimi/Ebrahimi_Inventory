ALTER TABLE "Invoice" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'SALE', ADD COLUMN "sourceInvoiceId" INTEGER;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_kind_check" CHECK ("kind" IN ('SALE', 'PURCHASE', 'RETURN'));
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD COLUMN "sourceItemId" INTEGER;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "InvoiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Invoice_kind_sourceInvoiceId_idx" ON "Invoice"("kind", "sourceInvoiceId");
CREATE INDEX "InvoiceItem_sourceItemId_idx" ON "InvoiceItem"("sourceItemId");
