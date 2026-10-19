INSERT INTO "Buyer" ("firstName", "lastName", "nationalId", "address", "createdAt", "updatedAt")
SELECT DISTINCT ON (COALESCE(i."buyerNationalId", ''), i."buyerFirstName", i."buyerLastName")
  i."buyerFirstName", i."buyerLastName", i."buyerNationalId", i."buyerAddress", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Invoice" i
WHERE NULLIF(BTRIM(i."buyerFirstName"), '') IS NOT NULL
  AND NULLIF(BTRIM(i."buyerLastName"), '') IS NOT NULL
ORDER BY COALESCE(i."buyerNationalId", ''), i."buyerFirstName", i."buyerLastName", i."id"
ON CONFLICT ("nationalId") DO NOTHING;

UPDATE "Invoice" i
SET "customerId" = b."id"
FROM "Buyer" b
WHERE i."customerId" IS NULL
  AND i."buyerFirstName" = b."firstName"
  AND i."buyerLastName" = b."lastName"
  AND i."buyerNationalId" IS NOT DISTINCT FROM b."nationalId";
