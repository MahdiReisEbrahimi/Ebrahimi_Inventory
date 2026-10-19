CREATE TYPE "InventoryTransactionType" AS ENUM ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT');
CREATE TABLE "InventoryTransaction" (
  "id" SERIAL NOT NULL, "productId" INTEGER NOT NULL, "type" "InventoryTransactionType" NOT NULL,
  "quantity" INTEGER NOT NULL, "unitPrice" INTEGER, "description" TEXT, "invoiceId" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Invoice" (
  "id" SERIAL NOT NULL, "number" TEXT NOT NULL, "buyerFirstName" TEXT, "buyerLastName" TEXT, "buyerNationalId" TEXT,
  "buyerAddress" TEXT, "notes" TEXT, "total" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InvoiceItem" (
  "id" SERIAL NOT NULL, "invoiceId" INTEGER NOT NULL, "productId" INTEGER NOT NULL, "name" TEXT NOT NULL, "unit" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL, "unitPrice" INTEGER NOT NULL, "total" INTEGER NOT NULL, CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StoreSettings" (
  "id" INTEGER NOT NULL DEFAULT 1, "name" TEXT NOT NULL DEFAULT 'فروشگاه', "address" TEXT NOT NULL DEFAULT '', "phone" TEXT NOT NULL DEFAULT '',
  "logoUrl" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX "InventoryTransaction_productId_createdAt_idx" ON "InventoryTransaction"("productId", "createdAt");
CREATE INDEX "InventoryTransaction_type_createdAt_idx" ON "InventoryTransaction"("type", "createdAt");
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK ("stock" >= 0);
