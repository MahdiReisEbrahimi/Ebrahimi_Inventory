ALTER TABLE "StoreSettings"
  ADD COLUMN "iban" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "defaultInvoiceNotes" TEXT NOT NULL DEFAULT '';

ALTER TABLE "InventoryTransaction" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TOMAN';

ALTER TABLE "Invoice"
  ADD COLUMN "buyerPhone" TEXT,
  ADD COLUMN "subtotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paidAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "settlement" TEXT NOT NULL DEFAULT 'CASH',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TOMAN',
  ADD COLUMN "issueDate" DATE,
  ADD COLUMN "sellerName" TEXT,
  ADD COLUMN "sellerAddress" TEXT,
  ADD COLUMN "sellerPhone" TEXT,
  ADD COLUMN "sellerLogoUrl" TEXT,
  ADD COLUMN "sellerIban" TEXT;

UPDATE "Invoice" SET "subtotal" = "total",
  "issueDate" = ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tehran')::date;
ALTER TABLE "Invoice" ALTER COLUMN "issueDate" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "issueDate" SET DEFAULT CURRENT_DATE;
ALTER TABLE "Invoice" ALTER COLUMN "currency" SET DEFAULT 'IRR';

-- Two phases avoid collisions with any already numeric invoice numbers.
UPDATE "Invoice" SET "number" = '__invoice_migration_' || "id"::text;
UPDATE "Invoice" SET "number" = lpad("id"::text, greatest(3, length("id"::text)), '0');
