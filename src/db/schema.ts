import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/** Money columns hold whole poisha (1 taka = 100). See src/lib/money.ts. */
const poisha = (name: string) => bigint(name, { mode: "number" });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Every row below belongs to exactly one user. Deleting a user removes their data. */
const ownerId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const entryType = pgEnum("entry_type", [
  "expense",
  "income",
  "transfer",
  "adjustment",
  "loan_principal",
  "loan_repayment",
]);

export const loanDirection = pgEnum("loan_direction", ["borrowed", "lent"]);

export const wallets = pgTable(
  "wallets",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: ownerId(),
    name: text().notNull(),
    openingBalance: poisha("opening_balance").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // Lets entries reference a wallet together with its owner (see entries below).
    unique("wallets_user_id_id_unique").on(t.userId, t.id),
    // Names must be unique among a user's active wallets, ignoring letter case.
    uniqueIndex("wallets_active_name_unique")
      .on(t.userId, sql`lower(${t.name})`)
      .where(sql`${t.archivedAt} is null`),
    check("wallets_opening_balance_check", sql`${t.openingBalance} >= 0`),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: ownerId(),
    name: text().notNull(),
    /** The reserved "Loan interest and fees" category. Not offered in forms, never archived. */
    isReserved: boolean("is_reserved").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("categories_user_id_id_unique").on(t.userId, t.id),
    uniqueIndex("categories_name_unique").on(t.userId, sql`lower(${t.name})`),
  ],
);

export const loans = pgTable(
  "loans",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: ownerId(),
    direction: loanDirection().notNull(),
    counterparty: text().notNull(),
    principal: poisha("principal").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("loans_user_id_id_unique").on(t.userId, t.id),
    check("loans_principal_check", sql`${t.principal} > 0`),
  ],
);

/**
 * The ledger. Every movement of money is one row, and wallet balances are
 * calculated from these rows. Nothing stores a running balance.
 *
 * `amount` is positive for every type except `adjustment`, where it is the signed
 * difference applied to the wallet. Loan interest or fees are separate rows
 * (`expense` for a borrowed loan, `income` for a lent loan) that carry the `loan_id`.
 *
 * The wallet, destination wallet, category and loan references include `user_id`,
 * so Postgres itself refuses an entry that points at another user's records.
 * They use NO ACTION (checked at the end of the statement) so deleting a user can
 * cascade through every table without tripping over the order of deletes.
 */
export const entries = pgTable(
  "entries",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: ownerId(),
    type: entryType().notNull(),
    walletId: integer("wallet_id").notNull(),
    /** Destination wallet. Set only for transfers. */
    toWalletId: integer("to_wallet_id"),
    categoryId: integer("category_id"),
    /** Deleting a loan removes its entries. */
    loanId: integer("loan_id"),
    amount: poisha("amount").notNull(),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "entries_wallet_owner_fk",
      columns: [t.userId, t.walletId],
      foreignColumns: [wallets.userId, wallets.id],
    }),
    foreignKey({
      name: "entries_to_wallet_owner_fk",
      columns: [t.userId, t.toWalletId],
      foreignColumns: [wallets.userId, wallets.id],
    }),
    foreignKey({
      name: "entries_category_owner_fk",
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    foreignKey({
      name: "entries_loan_owner_fk",
      columns: [t.userId, t.loanId],
      foreignColumns: [loans.userId, loans.id],
    }).onDelete("cascade"),
    index("entries_wallet_idx").on(t.userId, t.walletId),
    index("entries_to_wallet_idx").on(t.userId, t.toWalletId),
    index("entries_date_idx").on(t.userId, t.entryDate),
    index("entries_loan_idx").on(t.userId, t.loanId),
    index("entries_category_idx").on(t.userId, t.categoryId),
    check("entries_amount_nonzero", sql`${t.amount} <> 0`),
    check(
      "entries_amount_sign",
      sql`${t.type} = 'adjustment' or ${t.amount} > 0`,
    ),
    check(
      "entries_transfer_shape",
      sql`(${t.type} = 'transfer' and ${t.toWalletId} is not null and ${t.toWalletId} <> ${t.walletId})
        or (${t.type} <> 'transfer' and ${t.toWalletId} is null)`,
    ),
    check(
      "entries_loan_shape",
      sql`(${t.type} in ('loan_principal', 'loan_repayment') and ${t.loanId} is not null)
        or (${t.type} in ('expense', 'income'))
        or (${t.type} in ('transfer', 'adjustment') and ${t.loanId} is null)`,
    ),
    check(
      "entries_expense_category",
      sql`${t.type} <> 'expense' or ${t.categoryId} is not null`,
    ),
  ],
);

/** One row per user. Created together with the account. */
export const settings = pgTable(
  "settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    monthStartDay: integer("month_start_day").notNull().default(1),
    alertsEnabled: boolean("alerts_enabled").notNull().default(false),
    monthlyLimit: poisha("monthly_limit"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "settings_month_start_day_check",
      sql`${t.monthStartDay} between 1 and 28`,
    ),
    check(
      "settings_monthly_limit_check",
      sql`${t.monthlyLimit} is null or ${t.monthlyLimit} > 0`,
    ),
  ],
);

/** Saved advice, one row per user and reporting period. A refresh replaces the row. */
export const aiAdvice = pgTable(
  "ai_advice",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: ownerId(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    /** Hash of the figures sent to the model. An unchanged hash skips a new request. */
    inputHash: text("input_hash").notNull(),
    payload: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("ai_advice_user_period_unique").on(t.userId, t.periodStart)],
);

/** How many requests each user has made to the AI service on each day (Dhaka time). */
export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: ownerId(),
    day: date({ mode: "string" }).notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day] }),
    check("ai_usage_count_check", sql`${t.count} >= 0`),
  ],
);

/**
 * Sign-in attempts per email, for the 15 minute lock. The email is the one typed,
 * so an address with no account locks exactly like a real one. Serverless
 * instances share no memory, so the lock lives here.
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: text().notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("login_attempts_email_idx").on(t.email, t.attemptedAt)],
);

export type Wallet = typeof wallets.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type AiAdvice = typeof aiAdvice.$inferSelect;

export * from "./auth-schema";
