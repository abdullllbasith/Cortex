-- AlterTable
ALTER TABLE "salary_structures" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Mark first active structure per tenant as default (if any)
UPDATE "salary_structures" s
SET "isDefault" = true
FROM (
  SELECT DISTINCT ON ("tenantId") id
  FROM "salary_structures"
  WHERE "isActive" = true
  ORDER BY "tenantId", "createdAt" ASC
) first_per_tenant
WHERE s.id = first_per_tenant.id;
