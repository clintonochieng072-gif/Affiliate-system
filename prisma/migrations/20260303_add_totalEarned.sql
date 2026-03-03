-- Migration: add totalEarned column to affiliates
-- Run this on your production database (Neon/Postgres) to add the missing column

ALTER TABLE IF EXISTS "affiliates"
ADD COLUMN IF NOT EXISTS "totalEarned" numeric(12,2) DEFAULT 0;

-- Optional: ensure default values for existing numeric balance columns if needed
ALTER TABLE IF EXISTS "affiliates"
ADD COLUMN IF NOT EXISTS "availableBalance" numeric(12,2) DEFAULT 0;

ALTER TABLE IF EXISTS "affiliates"
ADD COLUMN IF NOT EXISTS "pendingBalance" numeric(12,2) DEFAULT 0;

-- Add index on email if missing (safe to run)
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON "affiliates" (email);
