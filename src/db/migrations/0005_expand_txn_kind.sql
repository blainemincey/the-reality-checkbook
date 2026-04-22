ALTER TYPE "public"."transaction_kind" ADD VALUE 'bill_pay' BEFORE 'interest';--> statement-breakpoint
ALTER TYPE "public"."transaction_kind" ADD VALUE 'check' BEFORE 'interest';--> statement-breakpoint
ALTER TYPE "public"."transaction_kind" ADD VALUE 'atm' BEFORE 'interest';--> statement-breakpoint
ALTER TYPE "public"."transaction_kind" ADD VALUE 'dividend' BEFORE 'transfer';--> statement-breakpoint
ALTER TYPE "public"."transaction_kind" ADD VALUE 'tax_payment' BEFORE 'fee';