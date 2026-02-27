-- Adds persistent profile completion flag for one-time first-login modal logic
ALTER TABLE "affiliates"
ADD COLUMN IF NOT EXISTS "profileCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing users who already have both name and phone as completed
UPDATE "affiliates"
SET "profileCompleted" = true
WHERE COALESCE(TRIM("name"), '') <> ''
  AND COALESCE(TRIM("phone"), '') <> '';
