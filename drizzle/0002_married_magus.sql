-- Hand-edited after generation (see design.md, Migration Plan):
-- 1. Refuse to run if any row exists that would be left without an owner.
-- 2. Remove the old global seed rows. Defaults are now created per user.
-- 3. Drop the old single-row primary key on settings before the user_id key is added.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "wallets")
     OR EXISTS (SELECT 1 FROM "entries")
     OR EXISTS (SELECT 1 FROM "loans")
     OR EXISTS (SELECT 1 FROM "ai_advice") THEN
    RAISE EXCEPTION 'Refusing to add owners: wallets, entries, loans or advice already hold rows with no owner';
  END IF;
END $$;--> statement-breakpoint
DELETE FROM "categories";--> statement-breakpoint
DELETE FROM "settings";--> statement-breakpoint
DELETE FROM "login_attempts";--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_user_id_day_pk" PRIMARY KEY("user_id","day"),
	CONSTRAINT "ai_usage_count_check" CHECK ("ai_usage"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_advice" DROP CONSTRAINT "ai_advice_period_start_unique";--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_single_row";--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "entries_wallet_id_wallets_id_fk";
--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "entries_to_wallet_id_wallets_id_fk";
--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "entries_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "entries_loan_id_loans_id_fk";
--> statement-breakpoint
DROP INDEX "login_attempts_attempted_at_idx";--> statement-breakpoint
DROP INDEX "categories_name_unique";--> statement-breakpoint
DROP INDEX "entries_wallet_idx";--> statement-breakpoint
DROP INDEX "entries_to_wallet_idx";--> statement-breakpoint
DROP INDEX "entries_date_idx";--> statement-breakpoint
DROP INDEX "entries_loan_idx";--> statement-breakpoint
DROP INDEX "entries_category_idx";--> statement-breakpoint
DROP INDEX "wallets_active_name_unique";--> statement-breakpoint
ALTER TABLE "ai_advice" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "user_id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
-- The composite foreign keys below need these unique keys to exist first.
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_advice" ADD CONSTRAINT "ai_advice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_wallet_owner_fk" FOREIGN KEY ("user_id","wallet_id") REFERENCES "public"."wallets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_to_wallet_owner_fk" FOREIGN KEY ("user_id","to_wallet_id") REFERENCES "public"."wallets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_category_owner_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_loan_owner_fk" FOREIGN KEY ("user_id","loan_id") REFERENCES "public"."loans"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_unique" ON "categories" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "entries_wallet_idx" ON "entries" USING btree ("user_id","wallet_id");--> statement-breakpoint
CREATE INDEX "entries_to_wallet_idx" ON "entries" USING btree ("user_id","to_wallet_id");--> statement-breakpoint
CREATE INDEX "entries_date_idx" ON "entries" USING btree ("user_id","entry_date");--> statement-breakpoint
CREATE INDEX "entries_loan_idx" ON "entries" USING btree ("user_id","loan_id");--> statement-breakpoint
CREATE INDEX "entries_category_idx" ON "entries" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_active_name_unique" ON "wallets" USING btree ("user_id",lower("name")) WHERE "wallets"."archived_at" is null;--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "ai_advice" ADD CONSTRAINT "ai_advice_user_period_unique" UNIQUE("user_id","period_start");