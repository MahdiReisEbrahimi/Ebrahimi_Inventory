-- A single invoice line can also carry the entire permitted invoice amount.
ALTER TABLE "InvoiceItem" ALTER COLUMN "unitPrice" TYPE DECIMAL(12, 0);
ALTER TABLE "InventoryTransaction" ALTER COLUMN "unitPrice" TYPE DECIMAL(12, 0);
