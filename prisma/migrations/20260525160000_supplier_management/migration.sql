-- Supplier Management module: extended supplier master data

CREATE TYPE "SupplierType" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'SERVICE_PROVIDER');
CREATE TYPE "PaymentTerms" AS ENUM ('IMMEDIATE', 'NET15', 'NET30', 'NET45', 'NET60');

ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "code" TEXT NOT NULL DEFAULT '';
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "type" "SupplierType" NOT NULL DEFAULT 'DISTRIBUTOR';
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "mobile" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "address" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'NET30';
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "taxNumber" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "bankDetailsEnc" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(14,2);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "rating" DECIMAL(3,2);

-- Backfill supplier codes for existing rows
WITH numbered AS (
  SELECT id, "tenantId",
         ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt") AS rn
  FROM suppliers
  WHERE code = '' OR code IS NULL
)
UPDATE suppliers s
SET code = 'SUP-' || LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE s.id = n.id;

CREATE TABLE IF NOT EXISTS "supplier_contacts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "designation" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "supplier_products" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "supplierSku" TEXT,
  "unitCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "minOrderQty" INTEGER NOT NULL DEFAULT 1,
  "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
  "isPreferred" BOOLEAN NOT NULL DEFAULT false,
  "lastPriceDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_tenantId_code_key" ON "suppliers"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "suppliers_tenantId_isActive_idx" ON "suppliers"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "suppliers_tenantId_type_idx" ON "suppliers"("tenantId", "type");

CREATE INDEX IF NOT EXISTS "supplier_contacts_tenantId_supplierId_idx" ON "supplier_contacts"("tenantId", "supplierId");
CREATE INDEX IF NOT EXISTS "supplier_contacts_tenantId_supplierId_isPrimary_idx" ON "supplier_contacts"("tenantId", "supplierId", "isPrimary");

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_products_tenantId_supplierId_productId_key" ON "supplier_products"("tenantId", "supplierId", "productId");
CREATE INDEX IF NOT EXISTS "supplier_products_tenantId_supplierId_idx" ON "supplier_products"("tenantId", "supplierId");
CREATE INDEX IF NOT EXISTS "supplier_products_tenantId_productId_idx" ON "supplier_products"("tenantId", "productId");

ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
