-- Module 02: AI Executive Assistant

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "ConversationIntent" AS ENUM ('QUERY', 'COMMAND', 'REPORT', 'FORECAST', 'AUTOMATION');

-- CreateTable
CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "summary" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "channel" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "intent" "ConversationIntent",
    "confidence" DOUBLE PRECISION,
    "sourcesUsed" JSONB NOT NULL DEFAULT '[]',
    "actionsTaken" JSONB NOT NULL DEFAULT '[]',
    "suggestedFollowUps" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_sessions_tenantId_userId_updatedAt_idx" ON "conversation_sessions"("tenantId", "userId", "updatedAt");
CREATE INDEX "conversation_sessions_tenantId_userId_archived_idx" ON "conversation_sessions"("tenantId", "userId", "archived");
CREATE INDEX "conversation_messages_sessionId_createdAt_idx" ON "conversation_messages"("sessionId", "createdAt");
CREATE INDEX "conversation_messages_tenantId_createdAt_idx" ON "conversation_messages"("tenantId", "createdAt");
CREATE INDEX "channel_connections_tenantId_enabled_idx" ON "channel_connections"("tenantId", "enabled");
CREATE UNIQUE INDEX "channel_connections_tenantId_channel_key" ON "channel_connections"("tenantId", "channel");

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
