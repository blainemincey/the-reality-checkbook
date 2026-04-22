-- Collapse cleared_state from 3 values to 2.
-- Rows previously marked 'reconciled' become 'cleared' (the user's workflow
-- treats cleared and reconciled as synonymous).
--
-- Postgres doesn't support ALTER TYPE … DROP VALUE, so we:
--   1. drop the column default
--   2. rename the existing enum out of the way
--   3. create a new enum with the desired values
--   4. cast the column through text to the new enum, mapping 'reconciled' → 'cleared'
--   5. restore the default
--   6. drop the old enum

ALTER TABLE "transactions" ALTER COLUMN "cleared_state" DROP DEFAULT;
--> statement-breakpoint
ALTER TYPE "public"."cleared_state" RENAME TO "cleared_state_old";
--> statement-breakpoint
CREATE TYPE "public"."cleared_state" AS ENUM('uncleared', 'cleared');
--> statement-breakpoint
ALTER TABLE "transactions"
  ALTER COLUMN "cleared_state" TYPE "public"."cleared_state"
  USING (
    CASE "cleared_state"::text
      WHEN 'reconciled' THEN 'cleared'::"public"."cleared_state"
      ELSE "cleared_state"::text::"public"."cleared_state"
    END
  );
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "cleared_state" SET DEFAULT 'uncleared';
--> statement-breakpoint
DROP TYPE "public"."cleared_state_old";
