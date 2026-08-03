-- Module 03: Multi-Agent Intelligence System

CREATE TYPE "AgentType" AS ENUM ('FINANCE', 'SALES', 'INVENTORY', 'OPERATIONS', 'EXECUTIVE');
CREATE TYPE "AgentTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');
CREATE TYPE "AgentTaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "AgentLogStatus" AS ENUM ('SUCCESS', 'FAILURE', 'PARTIAL');

CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "action" TEXT NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "status" "AgentLogStatus" NOT NULL DEFAULT 'SUCCESS',
    "durationMs" INTEGER,
    "userId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "agentType" "AgentType",
    "priority" "AgentTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "bullJobId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_memories_tenantId_agentType_key_key" ON "agent_memories"("tenantId", "agentType", "key");
CREATE INDEX "agent_memories_tenantId_agentType_idx" ON "agent_memories"("tenantId", "agentType");
CREATE INDEX "agent_memories_expiresAt_idx" ON "agent_memories"("expiresAt");
CREATE INDEX "agent_logs_tenantId_agentType_createdAt_idx" ON "agent_logs"("tenantId", "agentType", "createdAt");
CREATE INDEX "agent_logs_tenantId_createdAt_idx" ON "agent_logs"("tenantId", "createdAt");
CREATE INDEX "agent_logs_taskId_idx" ON "agent_logs"("taskId");
CREATE INDEX "agent_tasks_tenantId_status_createdAt_idx" ON "agent_tasks"("tenantId", "status", "createdAt");
CREATE INDEX "agent_tasks_tenantId_userId_idx" ON "agent_tasks"("tenantId", "userId");
CREATE INDEX "agent_tasks_status_priority_idx" ON "agent_tasks"("status", "priority");

ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
