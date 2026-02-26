-- Affiliate management system upgrade
-- Adds 4-level progression, profile fields, admin controls, notifications, and referral counters

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('AFFILIATE', 'ADMIN');
  END IF;
END $$;

ALTER TYPE "AffiliateLevel" ADD VALUE IF NOT EXISTS 'LEVEL_3';
ALTER TYPE "AffiliateLevel" ADD VALUE IF NOT EXISTS 'LEVEL_4';

ALTER TABLE "affiliates"
  ADD COLUMN IF NOT EXISTS "phone" text,
  ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'AFFILIATE',
  ADD COLUMN IF NOT EXISTS "totalReferralsIndividual" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalReferralsProfessional" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isFrozen" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "promotedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "level4EligibleAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "registrationDate" timestamptz NOT NULL DEFAULT now();

ALTER TABLE "referrals"
  ADD COLUMN IF NOT EXISTS "clientName" text,
  ADD COLUMN IF NOT EXISTS "promotionAppliedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "referralDate" timestamptz NOT NULL DEFAULT now();

UPDATE "referrals"
SET "status" = 'active'
WHERE "status"::text = 'paid';

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "completedAt" timestamptz;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY,
  "affiliateId" text,
  "roleTarget" "UserRole" NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "isRead" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "notifications_affiliateId_idx" ON "notifications"("affiliateId");
CREATE INDEX IF NOT EXISTS "notifications_roleTarget_idx" ON "notifications"("roleTarget");
CREATE INDEX IF NOT EXISTS "notifications_isRead_idx" ON "notifications"("isRead");
CREATE INDEX IF NOT EXISTS "notifications_createdAt_idx" ON "notifications"("createdAt");

COMMIT;
