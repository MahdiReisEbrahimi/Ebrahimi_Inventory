-- Extend products with inventory, pricing, and lifecycle fields.
ALTER TABLE "Product"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'عدد',
  ADD COLUMN "buyPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sellPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "minStock" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Existing installations may already have products; generate a stable temporary SKU for them.
UPDATE "Product" SET "sku" = 'LEGACY-' || "id" WHERE "sku" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "sku" SET NOT NULL;
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

CREATE TYPE "PriceChangeType" AS ENUM ('SINGLE', 'BULK');

CREATE TABLE "PriceHistory" (
  "id" SERIAL NOT NULL,
  "productId" INTEGER NOT NULL,
  "oldBuyPrice" INTEGER,
  "newBuyPrice" INTEGER,
  "oldSellPrice" INTEGER,
  "newSellPrice" INTEGER,
  "changePercent" DOUBLE PRECISION,
  "type" "PriceChangeType" NOT NULL,
  "changedById" INTEGER,
  "changedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PriceHistory_productId_createdAt_idx" ON "PriceHistory"("productId", "createdAt");
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
  "id" SERIAL NOT NULL,
  "productId" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_productId_createdAt_idx" ON "AuditLog"("productId", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
