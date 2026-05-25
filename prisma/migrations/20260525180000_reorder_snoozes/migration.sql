-- CreateTable
CREATE TABLE "reorder_snoozes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "snoozedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reorder_snoozes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reorder_snoozes_tenantId_productId_key" ON "reorder_snoozes"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "reorder_snoozes_tenantId_snoozedUntil_idx" ON "reorder_snoozes"("tenantId", "snoozedUntil");

-- AddForeignKey
ALTER TABLE "reorder_snoozes" ADD CONSTRAINT "reorder_snoozes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
