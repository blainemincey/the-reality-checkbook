CREATE TYPE "public"."transaction_kind" AS ENUM('deposit', 'payment', 'interest', 'transfer', 'fee', 'refund', 'other');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payee_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "kind" "transaction_kind";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE set null ON UPDATE no action;