-- Financial architecture redesign migration
-- Applies plan/level commission matrix + balance-ledger withdrawals.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AffiliateLevel') THEN
    CREATE TYPE "AffiliateLevel" AS ENUM ('LEVEL_1', 'LEVEL_2');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WithdrawalStatus') THEN
    CREATE TYPE "WithdrawalStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END $$;

ALTER TABLE "affiliates"
  ADD COLUMN IF NOT EXISTS "level" "AffiliateLevel" NOT NULL DEFAULT 'LEVEL_1',
  ADD COLUMN IF NOT EXISTS "pendingBalance" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "availableBalance" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalEarned" numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "plans" (
  "id" text PRIMARY KEY,
  "planType" text UNIQUE NOT NULL,
  "name" text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "plans_planType_idx" ON "plans"("planType");
CREATE INDEX IF NOT EXISTS "plans_isActive_idx" ON "plans"("isActive");

CREATE TABLE IF NOT EXISTS "commission_rules" (
  "id" text PRIMARY KEY,
  "affiliateLevel" "AffiliateLevel" NOT NULL,
  "planId" text NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
  "rewardAmount" numeric(10,2) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("affiliateLevel", "planId")
);

CREATE INDEX IF NOT EXISTS "commission_rules_affiliateLevel_idx" ON "commission_rules"("affiliateLevel");
CREATE INDEX IF NOT EXISTS "commission_rules_planId_idx" ON "commission_rules"("planId");

INSERT INTO "plans" ("id", "planType", "name", "isActive")
VALUES
  (gen_random_uuid()::text, 'Individual', 'Individual Plan', true),
  (gen_random_uuid()::text, 'Professional', 'Professional Plan', true)
ON CONFLICT ("planType") DO NOTHING;

INSERT INTO "commission_rules" ("id", "affiliateLevel", "planId", "rewardAmount")
SELECT gen_random_uuid()::text, 'LEVEL_1', p."id", 300 FROM "plans" p WHERE p."planType" = 'Individual'
ON CONFLICT ("affiliateLevel", "planId") DO UPDATE SET "rewardAmount" = EXCLUDED."rewardAmount";

INSERT INTO "commission_rules" ("id", "affiliateLevel", "planId", "rewardAmount")
SELECT gen_random_uuid()::text, 'LEVEL_1', p."id", 800 FROM "plans" p WHERE p."planType" = 'Professional'
ON CONFLICT ("affiliateLevel", "planId") DO UPDATE SET "rewardAmount" = EXCLUDED."rewardAmount";

INSERT INTO "commission_rules" ("id", "affiliateLevel", "planId", "rewardAmount")
SELECT gen_random_uuid()::text, 'LEVEL_2', p."id", 450 FROM "plans" p WHERE p."planType" = 'Individual'
ON CONFLICT ("affiliateLevel", "planId") DO UPDATE SET "rewardAmount" = EXCLUDED."rewardAmount";

INSERT INTO "commission_rules" ("id", "affiliateLevel", "planId", "rewardAmount")
SELECT gen_random_uuid()::text, 'LEVEL_2', p."id", 1200 FROM "plans" p WHERE p."planType" = 'Professional'
ON CONFLICT ("affiliateLevel", "planId") DO UPDATE SET "rewardAmount" = EXCLUDED."rewardAmount";

ALTER TABLE "referrals"
  ADD COLUMN IF NOT EXISTS "planId" text,
  ADD COLUMN IF NOT EXISTS "planType" text,
  ADD COLUMN IF NOT EXISTS "reference" text;

UPDATE "referrals"
SET "reference" = "paymentReference"
WHERE "reference" IS NULL
  AND "paymentReference" IS NOT NULL;

UPDATE "referrals"
SET "planType" = 'Individual'
WHERE "planType" IS NULL;

UPDATE "referrals" r
SET "planId" = p."id"
FROM "plans" p
WHERE r."planId" IS NULL
  AND p."planType" = COALESCE(r."planType", 'Individual');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_reference_key'
  ) THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_reference_key" UNIQUE ("reference");
  END IF;
END $$;

ALTER TABLE "referrals"
  ALTER COLUMN "planId" SET NOT NULL,
  ALTER COLUMN "planType" SET NOT NULL,
  ALTER COLUMN "reference" SET NOT NULL;

ALTER TABLE "referrals"
  DROP COLUMN IF EXISTS "productSlug",
  DROP COLUMN IF EXISTS "amountPaid",
  DROP COLUMN IF EXISTS "paymentReference";

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "amount" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "providerReference" text;

UPDATE "withdrawals"
SET "amount" = "requestedAmount"
WHERE "amount" IS NULL;

ALTER TABLE "withdrawals"
  ALTER COLUMN "amount" SET NOT NULL;

ALTER TABLE "withdrawals"
  DROP COLUMN IF EXISTS "requestedAmount",
  DROP COLUMN IF EXISTS "platformFee",
  DROP COLUMN IF EXISTS "payoutAmount",
  DROP COLUMN IF EXISTS "paystackTransferFee",
  DROP COLUMN IF EXISTS "paystackReference";

ALTER TABLE "withdrawals"
  ALTER COLUMN "status" TYPE "WithdrawalStatus" USING "status"::"WithdrawalStatus";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_providerReference_key'
  ) THEN
    ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_providerReference_key" UNIQUE ("providerReference");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "withdrawals_providerReference_idx" ON "withdrawals"("providerReference");

COMMIT;
