-- Module 04: Enterprise Analytics Engine

CREATE TYPE "InventoryEventType" AS ENUM ('RESTOCK', 'SALE', 'ADJUSTMENT', 'WASTE');
CREATE TYPE "CustomerEventType" AS ENUM ('VISIT', 'PURCHASE', 'CHURN', 'RETURN', 'COMPLAINT');
CREATE TYPE "SupplierEventType" AS ENUM ('ORDER', 'DELIVERY', 'DELAY', 'RETURN');
CREATE TYPE "AnalyticsSnapshotType" AS ENUM ('SALES_HOURLY', 'SALES_DAILY', 'SALES_WEEKLY', 'CUSTOMER_DAILY', 'INVENTORY_HOURLY', 'SUPPLIER_DAILY', 'EXECUTIVE_DAILY');

CREATE TABLE "sales_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT,
    "customerId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL DEFAULT 'direct',
    "branchId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "InventoryEventType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CustomerEventType" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" "SupplierEventType" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "snapshotType" "AnalyticsSnapshotType" NOT NULL,
    "period" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "lastEventAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_events_tenantId_timestamp_idx" ON "sales_events"("tenantId", "timestamp");
CREATE INDEX "sales_events_tenantId_branchId_timestamp_idx" ON "sales_events"("tenantId", "branchId", "timestamp");
CREATE INDEX "sales_events_tenantId_productId_timestamp_idx" ON "sales_events"("tenantId", "productId", "timestamp");
CREATE INDEX "sales_events_tenantId_customerId_timestamp_idx" ON "sales_events"("tenantId", "customerId", "timestamp");
CREATE INDEX "inventory_events_tenantId_timestamp_idx" ON "inventory_events"("tenantId", "timestamp");
CREATE INDEX "inventory_events_tenantId_productId_timestamp_idx" ON "inventory_events"("tenantId", "productId", "timestamp");
CREATE INDEX "inventory_events_tenantId_type_timestamp_idx" ON "inventory_events"("tenantId", "type", "timestamp");
CREATE INDEX "customer_events_tenantId_timestamp_idx" ON "customer_events"("tenantId", "timestamp");
CREATE INDEX "customer_events_tenantId_customerId_timestamp_idx" ON "customer_events"("tenantId", "customerId", "timestamp");
CREATE INDEX "customer_events_tenantId_type_timestamp_idx" ON "customer_events"("tenantId", "type", "timestamp");
CREATE INDEX "supplier_events_tenantId_timestamp_idx" ON "supplier_events"("tenantId", "timestamp");
CREATE INDEX "supplier_events_tenantId_supplierId_timestamp_idx" ON "supplier_events"("tenantId", "supplierId", "timestamp");
CREATE INDEX "supplier_events_tenantId_type_timestamp_idx" ON "supplier_events"("tenantId", "type", "timestamp");
CREATE UNIQUE INDEX "analytics_snapshots_tenantId_snapshotType_period_key" ON "analytics_snapshots"("tenantId", "snapshotType", "period");
CREATE INDEX "analytics_snapshots_tenantId_snapshotType_computedAt_idx" ON "analytics_snapshots"("tenantId", "snapshotType", "computedAt");

ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_events" ADD CONSTRAINT "customer_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_events" ADD CONSTRAINT "supplier_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
