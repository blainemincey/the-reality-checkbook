-- Switch users from email to username as the primary identifier.
--   1. add the column nullable
--   2. backfill from email's local-part (lowercased)
--   3. resolve collisions by suffixing '_2', '_3', ... (rare in practice)
--   4. enforce NOT NULL + UNIQUE
--   5. drop the email column + its unique constraint

ALTER TABLE "users" ADD COLUMN "username" text;
--> statement-breakpoint
UPDATE "users" SET "username" = LOWER(SPLIT_PART("email", '@', 1));
--> statement-breakpoint
-- Deterministically deduplicate: for any collision, keep the oldest as-is and
-- suffix the rest with '_2', '_3', ... ordered by created_at.
WITH ranked AS (
  SELECT "id", "username",
         ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "created_at") AS rn
  FROM "users"
)
UPDATE "users" u
SET "username" = ranked."username" || '_' || ranked.rn
FROM ranked
WHERE u."id" = ranked."id" AND ranked.rn > 1;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE ("username");
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email";
