-- AlterTable
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
