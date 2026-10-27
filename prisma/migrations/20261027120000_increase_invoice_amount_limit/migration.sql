-- Widen invoice amounts without rounding or converting existing rial/toman values.
ALTER TABLE "Invoice"
  ALTER COLUMN "total" TYPE DECIMAL(12, 0),
  ALTER COLUMN "subtotal" TYPE DECIMAL(12, 0),
  ALTER COLUMN "discount" TYPE DECIMAL(12, 0),
  ALTER COLUMN "paidAmount" TYPE DECIMAL(12, 0);

ALTER TABLE "InvoiceItem" ALTER COLUMN "total" TYPE DECIMAL(12, 0);
