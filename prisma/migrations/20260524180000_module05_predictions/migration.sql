-- Module 05: Predictive Intelligence Engine

CREATE TYPE "FeatureEntityType" AS ENUM ('SALES', 'CUSTOMER', 'INVENTORY', 'SUPPLIER');
CREATE TYPE "MLModelType" AS ENUM ('SALES_FORECAST', 'INVENTORY_FORECAST', 'CUSTOMER_CHURN', 'SUPPLIER_RISK');
CREATE TYPE "MLModelStatus" AS ENUM ('ACTIVE', 'TRAINING', 'DEPRECATED');
CREATE TYPE "MLPredictionType" AS ENUM ('SALES_FORECAST', 'INVENTORY_STOCKOUT', 'CUSTOMER_CHURN', 'SUPPLIER_RISK');
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');
CREATE TYPE "AlertType" AS ENUM ('STOCKOUT', 'REVENUE_DROP', 'CUSTOMER_CHURN', 'SUPPLIER_DELAY', 'GENERAL');

CREATE TABLE "feature_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "FeatureEntityType" NOT NULL,
    "entityId" TEXT NOT NULL DEFAULT 'tenant',
    "features" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feature_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ml_models" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modelType" "MLModelType" NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" "MLModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "trainedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ml_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ml_predictions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modelId" TEXT,
    "predictionType" "MLPredictionType" NOT NULL,
    "entityId" TEXT,
    "payload" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "ml_predictions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedEntityId" TEXT,
    "relatedEntityType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ruleType" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_snapshots_tenantId_entityType_entityId_key" ON "feature_snapshots"("tenantId", "entityType", "entityId");
CREATE INDEX "feature_snapshots_tenantId_entityType_computedAt_idx" ON "feature_snapshots"("tenantId", "entityType", "computedAt");

CREATE INDEX "ml_models_tenantId_modelType_status_idx" ON "ml_models"("tenantId", "modelType", "status");

CREATE INDEX "ml_predictions_tenantId_predictionType_computedAt_idx" ON "ml_predictions"("tenantId", "predictionType", "computedAt");
CREATE INDEX "ml_predictions_tenantId_entityId_predictionType_idx" ON "ml_predictions"("tenantId", "entityId", "predictionType");

CREATE INDEX "alerts_tenantId_isRead_createdAt_idx" ON "alerts"("tenantId", "isRead", "createdAt");
CREATE INDEX "alerts_tenantId_severity_createdAt_idx" ON "alerts"("tenantId", "severity", "createdAt");
CREATE INDEX "alerts_tenantId_type_relatedEntityId_createdAt_idx" ON "alerts"("tenantId", "type", "relatedEntityId", "createdAt");

CREATE UNIQUE INDEX "alert_rules_tenantId_ruleType_key" ON "alert_rules"("tenantId", "ruleType");
CREATE INDEX "alert_rules_tenantId_enabled_idx" ON "alert_rules"("tenantId", "enabled");

ALTER TABLE "feature_snapshots" ADD CONSTRAINT "feature_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ml_models" ADD CONSTRAINT "ml_models_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ml_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
