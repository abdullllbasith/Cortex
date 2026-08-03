-- Module 12: Inventory Operations

-- Enums
CREATE TYPE "ProductUnit" AS ENUM ('PCS', 'KG', 'L', 'M', 'BOX', 'PACK');
CREATE TYPE "StockTransactionType" AS ENUM (
  'PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT',
  'RETURN_IN', 'RETURN_OUT', 'DAMAGE', 'WRITE_OFF', 'OPENING'
);
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');
CREATE TYPE "InventoryCostingMethod" AS ENUM ('FIFO', 'WEIGHTED_AVERAGE', 'LIFO');

-- Categories
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_tenantId_slug_key" ON "categories"("tenantId", "slug");
CREATE INDEX "categories_tenantId_parentId_idx" ON "categories"("tenantId", "parentId");

ALTER TABLE "categories" ADD CONSTRAINT "categories_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend products for inventory operations (retain legacy columns)
ALTER TABLE "products" ADD COLUMN "sku" TEXT;
ALTER TABLE "products" ADD COLUMN "barcode" TEXT;
ALTER TABLE "products" ADD COLUMN "slug" TEXT;
ALTER TABLE "products" ADD COLUMN "description" TEXT;
ALTER TABLE "products" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "products" ADD COLUMN "unit" "ProductUnit" NOT NULL DEFAULT 'PCS';
ALTER TABLE "products" ADD COLUMN "costPrice" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "sellingPrice" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "minSellingPrice" DECIMAL(14,4);
ALTER TABLE "products" ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "isService" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "trackInventory" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "reorderPoint" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "reorderQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "leadTimeDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "products" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "products" ADD COLUMN "weight" DECIMAL(10,3);
ALTER TABLE "products" ADD COLUMN "dimensions" JSONB NOT NULL DEFAULT '{}';

UPDATE "products"
SET
  "sku" = COALESCE("sku", 'SKU-' || "id"),
  "slug" = COALESCE(
    "slug",
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
      || '-' || SUBSTRING("id", 1, 6)
  )
WHERE "sku" IS NULL OR "slug" IS NULL;

ALTER TABLE "products" ALTER COLUMN "sku" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "products_tenantId_sku_key" ON "products"("tenantId", "sku");
CREATE UNIQUE INDEX "products_tenantId_slug_key" ON "products"("tenantId", "slug");
CREATE INDEX "products_tenantId_barcode_idx" ON "products"("tenantId", "barcode");
CREATE INDEX "products_tenantId_categoryId_idx" ON "products"("tenantId", "categoryId");
CREATE INDEX "products_tenantId_isActive_idx" ON "products"("tenantId", "isActive");

ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "costPrice" DECIMAL(14,4),
    "sellingPrice" DECIMAL(14,4),
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_variants_tenantId_sku_key" ON "product_variants"("tenantId", "sku");
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");
CREATE INDEX "product_variants_tenantId_barcode_idx" ON "product_variants"("tenantId", "barcode");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouses_tenantId_code_key" ON "warehouses"("tenantId", "code");
CREATE INDEX "warehouses_tenantId_isActive_idx" ON "warehouses"("tenantId", "isActive");

ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_locations" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aisle" TEXT,
    "shelf" TEXT,
    "bin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_locations_warehouseId_idx" ON "stock_locations"("warehouseId");

ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "stock_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "transactionType" "StockTransactionType" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_ledger_tenantId_productId_createdAt_idx" ON "stock_ledger"("tenantId", "productId", "createdAt");
CREATE INDEX "stock_ledger_tenantId_warehouseId_createdAt_idx" ON "stock_ledger"("tenantId", "warehouseId", "createdAt");
CREATE INDEX "stock_ledger_tenantId_referenceType_referenceId_idx" ON "stock_ledger"("tenantId", "referenceType", "referenceId");

ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_performedBy_fkey"
  FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_balances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "quantityReserved" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "quantityOnOrder" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_balances_tenantId_productId_variantId_warehouseId_key"
  ON "stock_balances"("tenantId", "productId", "variantId", "warehouseId") NULLS NOT DISTINCT;
CREATE INDEX "stock_balances_tenantId_warehouseId_idx" ON "stock_balances"("tenantId", "warehouseId");
CREATE INDEX "stock_balances_tenantId_productId_idx" ON "stock_balances"("tenantId", "productId");

ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "stock_reservations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_reservations_tenantId_referenceId_idx" ON "stock_reservations"("tenantId", "referenceId");
CREATE INDEX "stock_reservations_tenantId_productId_warehouseId_idx" ON "stock_reservations"("tenantId", "productId", "warehouseId");

ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "items" JSONB NOT NULL DEFAULT '[]',
    "initiatedBy" TEXT,
    "completedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_transfers_tenantId_status_idx" ON "stock_transfers"("tenantId", "status");
CREATE INDEX "stock_transfers_tenantId_createdAt_idx" ON "stock_transfers"("tenantId", "createdAt");

ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_fromWarehouseId_fkey"
  FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_toWarehouseId_fkey"
  FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_initiatedBy_fkey"
  FOREIGN KEY ("initiatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_completedBy_fkey"
  FOREIGN KEY ("completedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Materialised balance sync: ledger insert updates quantityOnHand via trigger
CREATE OR REPLACE FUNCTION apply_stock_ledger_to_balance()
RETURNS TRIGGER AS $$
DECLARE
  delta NUMERIC(14,4);
  balance_id TEXT;
BEGIN
  IF NEW."transactionType" IN ('PURCHASE', 'TRANSFER_IN', 'RETURN_IN', 'OPENING') THEN
    delta := ABS(NEW."quantity");
  ELSIF NEW."transactionType" IN ('SALE', 'TRANSFER_OUT', 'RETURN_OUT', 'DAMAGE', 'WRITE_OFF') THEN
    delta := -ABS(NEW."quantity");
  ELSIF NEW."transactionType" = 'ADJUSTMENT' THEN
    delta := NEW."quantity";
  ELSE
    delta := 0;
  END IF;

  SELECT "id" INTO balance_id
  FROM "stock_balances"
  WHERE "tenantId" = NEW."tenantId"
    AND "productId" = NEW."productId"
    AND "warehouseId" = NEW."warehouseId"
    AND "variantId" IS NOT DISTINCT FROM NEW."variantId"
  FOR UPDATE;

  IF balance_id IS NULL THEN
    INSERT INTO "stock_balances" (
      "id", "tenantId", "productId", "variantId", "warehouseId",
      "quantityOnHand", "quantityReserved", "quantityOnOrder", "lastUpdatedAt"
    )
    VALUES (
      md5(random()::text || clock_timestamp()::text),
      NEW."tenantId", NEW."productId", NEW."variantId", NEW."warehouseId",
      delta, 0, 0, CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE "stock_balances"
    SET
      "quantityOnHand" = "quantityOnHand" + delta,
      "lastUpdatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = balance_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_ledger_balance_trigger
AFTER INSERT ON "stock_ledger"
FOR EACH ROW
EXECUTE FUNCTION apply_stock_ledger_to_balance();
