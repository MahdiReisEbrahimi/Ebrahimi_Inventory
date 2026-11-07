-- Older local accounting migrations may have added this constraint.
-- Sales are now explicitly allowed to create negative inventory.
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_stock_nonnegative";
