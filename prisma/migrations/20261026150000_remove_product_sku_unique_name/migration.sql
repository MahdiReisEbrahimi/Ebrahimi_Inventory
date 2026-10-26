BEGIN;

-- Lock writes while validating existing names and changing the unique key.
LOCK TABLE "Product" IN ACCESS EXCLUSIVE MODE;

-- Stop without changing data if names need manual correction.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE btrim("name") = '') THEN
    RAISE EXCEPTION 'Product names cannot be empty. Correct blank names before migrating.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Product" GROUP BY btrim("name") HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Product names must be unique. Resolve duplicate names before migrating.';
  END IF;
END $$;

UPDATE "Product" SET "name" = btrim("name") WHERE "name" <> btrim("name");
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");
ALTER TABLE "Product" DROP COLUMN "sku";

COMMIT;
