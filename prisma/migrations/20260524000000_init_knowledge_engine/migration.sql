-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'STARTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profile" JSONB NOT NULL DEFAULT '{}',
    "purchaseHistory" JSONB NOT NULL DEFAULT '[]',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "communicationHistory" JSONB NOT NULL DEFAULT '[]',
    "loyaltyData" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "embeddingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "embeddingContentHash" TEXT,
    "embeddingUpdatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "catalog" JSONB NOT NULL DEFAULT '{}',
    "inventoryLevel" INTEGER NOT NULL DEFAULT 0,
    "supplierInfo" JSONB NOT NULL DEFAULT '{}',
    "pricingHistory" JSONB NOT NULL DEFAULT '[]',
    "embedding" vector(1536),
    "embeddingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "embeddingContentHash" TEXT,
    "embeddingUpdatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryHistory" JSONB NOT NULL DEFAULT '[]',
    "reliabilityMetrics" JSONB NOT NULL DEFAULT '{}',
    "costTrends" JSONB NOT NULL DEFAULT '[]',
    "embedding" vector(1536),
    "embeddingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "embeddingContentHash" TEXT,
    "embeddingUpdatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_knowledge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "embeddingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "embeddingContentHash" TEXT,
    "embeddingUpdatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_knowledge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- Foreign keys
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_knowledge" ADD CONSTRAINT "business_knowledge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- B-tree indexes
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");
CREATE INDEX "customers_tenantId_embeddingStatus_idx" ON "customers"("tenantId", "embeddingStatus");
CREATE INDEX "customers_tenantId_updatedAt_idx" ON "customers"("tenantId", "updatedAt");

CREATE INDEX "products_tenantId_idx" ON "products"("tenantId");
CREATE INDEX "products_tenantId_name_idx" ON "products"("tenantId", "name");
CREATE INDEX "products_tenantId_embeddingStatus_idx" ON "products"("tenantId", "embeddingStatus");

CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");
CREATE INDEX "suppliers_tenantId_name_idx" ON "suppliers"("tenantId", "name");
CREATE INDEX "suppliers_tenantId_embeddingStatus_idx" ON "suppliers"("tenantId", "embeddingStatus");

CREATE INDEX "business_knowledge_tenantId_idx" ON "business_knowledge"("tenantId");
CREATE INDEX "business_knowledge_tenantId_type_idx" ON "business_knowledge"("tenantId", "type");
CREATE INDEX "business_knowledge_tenantId_embeddingStatus_idx" ON "business_knowledge"("tenantId", "embeddingStatus");

CREATE INDEX "knowledge_audit_logs_tenantId_entityType_entityId_idx" ON "knowledge_audit_logs"("tenantId", "entityType", "entityId");
CREATE INDEX "knowledge_audit_logs_tenantId_createdAt_idx" ON "knowledge_audit_logs"("tenantId", "createdAt");

-- HNSW vector indexes for cosine similarity search
CREATE INDEX "customers_embedding_hnsw_idx" ON "customers" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "products_embedding_hnsw_idx" ON "products" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "suppliers_embedding_hnsw_idx" ON "suppliers" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "business_knowledge_embedding_hnsw_idx" ON "business_knowledge" USING hnsw ("embedding" vector_cosine_ops);
