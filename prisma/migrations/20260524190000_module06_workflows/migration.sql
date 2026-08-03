-- Module 06: Workflow Automation Engine

CREATE TYPE "WorkflowTriggerType" AS ENUM ('MANUAL', 'EVENT', 'SCHEDULE', 'WEBHOOK');
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "WorkflowNodeExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED');

CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "WorkflowTriggerType" NOT NULL DEFAULT 'MANUAL',
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "webhookToken" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "inputData" JSONB NOT NULL DEFAULT '{}',
    "outputData" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "resumeFromNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_node_executions" (
    "id" TEXT NOT NULL,
    "workflowExecutionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" "WorkflowNodeExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "inputData" JSONB NOT NULL DEFAULT '{}',
    "outputData" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "workflow_node_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "definitionJSON" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_definitions_webhookToken_key" ON "workflow_definitions"("webhookToken");
CREATE INDEX "workflow_definitions_tenantId_isActive_idx" ON "workflow_definitions"("tenantId", "isActive");
CREATE INDEX "workflow_definitions_tenantId_triggerType_isActive_idx" ON "workflow_definitions"("tenantId", "triggerType", "isActive");

CREATE INDEX "workflow_executions_tenantId_status_createdAt_idx" ON "workflow_executions"("tenantId", "status", "createdAt");
CREATE INDEX "workflow_executions_workflowDefinitionId_createdAt_idx" ON "workflow_executions"("workflowDefinitionId", "createdAt");

CREATE INDEX "workflow_node_executions_workflowExecutionId_nodeId_idx" ON "workflow_node_executions"("workflowExecutionId", "nodeId");

CREATE INDEX "workflow_templates_category_isPublic_idx" ON "workflow_templates"("category", "isPublic");

ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_node_executions" ADD CONSTRAINT "workflow_node_executions_workflowExecutionId_fkey" FOREIGN KEY ("workflowExecutionId") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
