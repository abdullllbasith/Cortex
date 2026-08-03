-- Repair: align init_knowledge_engine TEXT columns with Prisma enums

CREATE TYPE "TenantPlan" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "BusinessKnowledgeType" AS ENUM ('POLICY', 'SOP', 'DOCUMENT', 'CONTRACT', 'REPORT');
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "tenants" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "plan" TYPE "TenantPlan" USING ("plan"::"TenantPlan");
ALTER TABLE "tenants" ALTER COLUMN "plan" SET DEFAULT 'STARTER'::"TenantPlan";

ALTER TABLE "customers" ALTER COLUMN "embeddingStatus" DROP DEFAULT;
ALTER TABLE "customers" ALTER COLUMN "embeddingStatus" TYPE "EmbeddingStatus" USING ("embeddingStatus"::"EmbeddingStatus");
ALTER TABLE "customers" ALTER COLUMN "embeddingStatus" SET DEFAULT 'PENDING'::"EmbeddingStatus";

ALTER TABLE "products" ALTER COLUMN "embeddingStatus" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "embeddingStatus" TYPE "EmbeddingStatus" USING ("embeddingStatus"::"EmbeddingStatus");
ALTER TABLE "products" ALTER COLUMN "embeddingStatus" SET DEFAULT 'PENDING'::"EmbeddingStatus";

ALTER TABLE "suppliers" ALTER COLUMN "embeddingStatus" DROP DEFAULT;
ALTER TABLE "suppliers" ALTER COLUMN "embeddingStatus" TYPE "EmbeddingStatus" USING ("embeddingStatus"::"EmbeddingStatus");
ALTER TABLE "suppliers" ALTER COLUMN "embeddingStatus" SET DEFAULT 'PENDING'::"EmbeddingStatus";

ALTER TABLE "business_knowledge" ALTER COLUMN "type" TYPE "BusinessKnowledgeType" USING ("type"::"BusinessKnowledgeType");

ALTER TABLE "business_knowledge" ALTER COLUMN "embeddingStatus" DROP DEFAULT;
ALTER TABLE "business_knowledge" ALTER COLUMN "embeddingStatus" TYPE "EmbeddingStatus" USING ("embeddingStatus"::"EmbeddingStatus");
ALTER TABLE "business_knowledge" ALTER COLUMN "embeddingStatus" SET DEFAULT 'PENDING'::"EmbeddingStatus";
