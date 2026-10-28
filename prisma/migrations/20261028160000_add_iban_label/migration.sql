ALTER TABLE "StoreSettings" ADD COLUMN "ibanLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Invoice" ADD COLUMN "sellerIbanLabel" TEXT;
