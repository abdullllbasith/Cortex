-- Finance accounting foundation alignment

-- Add TRANSFER to journal reference types
ALTER TYPE "JournalReferenceType" ADD VALUE IF NOT EXISTS 'TRANSFER';

-- Journal entry void tracking
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "voidedBy" TEXT;

-- Fiscal period close tracking
ALTER TABLE "fiscal_periods" ADD COLUMN IF NOT EXISTS "closedBy" TEXT;
ALTER TABLE "fiscal_periods" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

-- Optional FK for voidedBy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_voidedBy_fkey'
  ) THEN
    ALTER TABLE "journal_entries"
      ADD CONSTRAINT "journal_entries_voidedBy_fkey"
      FOREIGN KEY ("voidedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
