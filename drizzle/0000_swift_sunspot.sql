CREATE TYPE "public"."entry_type" AS ENUM('expense', 'income', 'transfer', 'adjustment', 'loan_principal', 'loan_repayment');--> statement-breakpoint
CREATE TYPE "public"."loan_direction" AS ENUM('borrowed', 'lent');--> statement-breakpoint
CREATE TABLE "ai_advice" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_advice_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"input_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_advice_period_start_unique" UNIQUE("period_start")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"is_reserved" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "entry_type" NOT NULL,
	"wallet_id" integer NOT NULL,
	"to_wallet_id" integer,
	"category_id" integer,
	"loan_id" integer,
	"amount" bigint NOT NULL,
	"entry_date" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_amount_nonzero" CHECK ("entries"."amount" <> 0),
	CONSTRAINT "entries_amount_sign" CHECK ("entries"."type" = 'adjustment' or "entries"."amount" > 0),
	CONSTRAINT "entries_transfer_shape" CHECK (("entries"."type" = 'transfer' and "entries"."to_wallet_id" is not null and "entries"."to_wallet_id" <> "entries"."wallet_id")
        or ("entries"."type" <> 'transfer' and "entries"."to_wallet_id" is null)),
	CONSTRAINT "entries_loan_shape" CHECK (("entries"."type" in ('loan_principal', 'loan_repayment') and "entries"."loan_id" is not null)
        or ("entries"."type" in ('expense', 'income'))
        or ("entries"."type" in ('transfer', 'adjustment') and "entries"."loan_id" is null)),
	CONSTRAINT "entries_expense_category" CHECK ("entries"."type" <> 'expense' or "entries"."category_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "loans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"direction" "loan_direction" NOT NULL,
	"counterparty" text NOT NULL,
	"principal" bigint NOT NULL,
	"due_date" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loans_principal_check" CHECK ("loans"."principal" > 0)
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"month_start_day" integer DEFAULT 1 NOT NULL,
	"alerts_enabled" boolean DEFAULT false NOT NULL,
	"monthly_limit" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_month_start_day_check" CHECK ("settings"."month_start_day" between 1 and 28),
	CONSTRAINT "settings_monthly_limit_check" CHECK ("settings"."monthly_limit" is null or "settings"."monthly_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wallets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_opening_balance_check" CHECK ("wallets"."opening_balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_to_wallet_id_wallets_id_fk" FOREIGN KEY ("to_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_unique" ON "categories" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "entries_wallet_idx" ON "entries" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "entries_to_wallet_idx" ON "entries" USING btree ("to_wallet_id");--> statement-breakpoint
CREATE INDEX "entries_date_idx" ON "entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "entries_loan_idx" ON "entries" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "entries_category_idx" ON "entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "login_attempts_attempted_at_idx" ON "login_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_active_name_unique" ON "wallets" USING btree (lower("name")) WHERE "wallets"."archived_at" is null;