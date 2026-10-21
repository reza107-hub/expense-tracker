## Context

Greenfield project, shared by the owner and their friends (each with a private account), deployed on Vercel (serverless, no always-running process). See `proposal.md` for motivation and scope. Constraints that shape the design:

- Next.js App Router. Reads in Server Components, writes in Server Actions. No API route handlers anywhere, including for authentication (see decision 5).
- Hosted PostgreSQL (Neon). Serverless functions open short-lived connections.
- Gemini free tier: rate limited and shared by all users, and prompts may be used by the provider.
- No background jobs. Anything time-based must be worked out when a page is rendered.
- Colours come from theme variables only (`@theme inline`, separate `:root` and `.dark` sets). Icons from Lucide, no emojis. Interactivity lives in small client components.

## Goals / Non-Goals

**Goals:**
- Balances and reports that are always correct after any edit or delete.
- A small surface: email and password accounts, a handful of tables, no admin area.
- Strong data isolation: one user must never be able to read or change another user's data, even through a coding mistake in a single query.
- AI advice that cannot corrupt numbers and leaks no free-text or identity.

**Non-Goals:**
- Roles, admin screens, social sign-in, email verification, forgot-password, account deletion.
- Live crypto prices, SMS or statement import, email or push alerts, scheduled jobs.
- Multi-currency. Everything is BDT.

## Decisions

### 1. One ledger table, balances calculated
All money movement is a row in `entries`. A wallet balance is its opening balance plus the sum of signed effects of entries that touch it. Nothing stores a running balance.

- Entry types: `expense`, `income`, `transfer`, `adjustment`, `loan_principal`, `loan_repayment`.
- `loan_id` is set on loan entries. A repayment's fee or interest is a second row (`expense` for borrowed, `income` for lent) linked to the loan, so the existing spending and income rules apply unchanged.
- Effect on `wallet_id` follows the type and, for loans, the direction. `transfer` also uses `to_wallet_id`. `adjustment` stores the signed difference.
- Loan outstanding = principal minus the sum of its repayment rows.

Alternative: a stored `balance` column updated on each write. Rejected: edits, deletes and concurrent requests can make it drift, and it is hard to audit.

Trade-off: balances need an aggregate query on each render. At personal volumes (thousands of rows per user) this is trivial. Add indexes on `(user_id, wallet_id)` and `(user_id, entry_date)`.

### 2. Money as integer poisha
Amounts are stored as `bigint` in poisha (1 taka = 100). Input is parsed from a decimal string with at most two places, and formatted back for display. No floating point anywhere in money code.

Alternative: `numeric(14,2)`. Rejected: drivers return it as a string, which invites accidental float maths.

### 3. Dates as calendar dates, month periods in Asia/Dhaka
`entry_date` is a `date`, not a timestamp, so no time zone shifts it. "Today" and "future date" checks use Asia/Dhaka. A single function maps `(date, startDay)` to a period start and end, and every report goes through it. The start day is limited to 1-28 so every month contains it.

### 4. Reads and writes
- Pages are Server Components that call a data layer directly. Interactive pieces (forms, confirm dialogs, charts, the refresh button) are small client components that call Server Actions.
- Server Actions validate input with a schema, require a signed-in user, write for that user, then revalidate affected paths.
- A multi-row write (loan repayment with a fee, loan delete) runs in one database transaction or batch so a failure leaves nothing half-written.

### 5. Accounts with Better Auth
Better Auth with its Drizzle adapter (provider `pg`) in our own database. It supports Next.js 16 and our Drizzle version, hashes passwords with scrypt, and offers request hooks and database hooks. The setup:

- **Credentials:** email and password only. Emails are normalised to lower case and trimmed. Password length 8 to 128. No verification email and no reset flow in version one. A new account is signed in straight away.
- **Sessions:** database-backed rows with a 90-day lifetime in an `httpOnly`, `sameSite=lax` cookie, `secure` in production. The cookie cache is off, so signing out takes effect at once. The price is one session lookup per request, which is small here.
- **No API route:** the library's `/api/auth` endpoint is not mounted. Sign-up, sign-in and sign-out are Server Actions that call the library's server-side API directly, and its Next.js cookie plugin lets those actions set and clear the session cookie. Session reads in Server Components use the same server API. If a needed flow turns out to require the HTTP endpoint, stop and raise it, because it would break the rule of using Server Actions only.
- **Allow-list:** a database hook on user creation rejects the registration when `ALLOWED_EMAILS` is set and the email is not in it. When it is unset, sign-up is open.
- **Defaults per user:** a database hook after user creation inserts the default categories (including the reserved loan category) and the settings row for that user. `requireUser()` also ensures they exist, with an insert that does nothing on conflict, so a failure between creating the user and seeding heals itself on the next request.
- **Per-email sign-in lock:** the library's own rate limit is per IP, so we add our own. A request hook on the sign-in endpoint, before the password is checked, takes a Postgres advisory lock on the email, counts that email's recent attempts, refuses if locked, and otherwise records one attempt row. A hook after a successful sign-in deletes that email's rows. Recording the attempt before the check means a burst of parallel guesses cannot slip past the limit, and the unchanged `computeLockedUntil` rule gives 5 attempts in 15 minutes and a 15-minute lock. Because it keys on the typed email, unknown emails behave identically.
- **Route guard:** `proxy.ts` only checks that a session cookie exists and redirects to `/sign-in` otherwise. It is not the security boundary. **Every Server Action and every data read calls `requireUser()`**, which validates the session against the database and returns the user id, because Server Actions are directly callable HTTP endpoints.
- **Cache Components:** anything that calls `requireUser()` reads cookies, so it renders behind a `<Suspense>` boundary, and no session read happens at the top of a layout.

Alternatives considered:
- Hand-rolled accounts with `jose` and `scrypt`. Reuses the earlier single-password code, but means writing and maintaining security-critical code (hashing parameters, session revocation, cookie handling) ourselves.
- Neon Auth. Built in and free, but ties sign-in to the database vendor and its own schema.
- Auth.js (NextAuth). Credentials login is a second-class path there, and it favours JWT sessions that are harder to revoke.

Trade-off: a library dependency. Pin the version, generate its schema with its CLI, and review its migrations on upgrade.

### 6. Alerts computed at render
No cron. The layout reads the user's settings, month spending and open loans, and renders any banners. After a save, revalidation re-renders the layout so a new alert shows immediately. Limit alerts trigger at 80% and above 100%. Loan alerts trigger at overdue or due within 7 days.

### 7. Gemini usage
- The model is `gemini-2.5-flash-lite`, read from env (`GEMINI_MODEL`) so a retired or renamed model needs no code change.
- The server builds a payload of aggregates only (see the `ai-spending-advice` spec) from the signed-in user's data and requests structured JSON output against a fixed schema. No email, name or id is included.
- The response is validated. Suggestions whose saving exceeds the category's spend are dropped.
- Results are stored in `ai_advice` keyed by user and period, with a hash of the input figures. A refresh whose hash matches the saved one skips the call, which protects the shared free quota.
- **Per-user daily limit:** `ai_usage (user_id, day, count)` with `day` in Asia/Dhaka. Before a call, one statement inserts or increments the row only while `count < 5`. If it changes nothing, the user has reached the limit and no call is made. If the call then fails, the count is decremented so a failure does not use up the allowance.
- Errors (rate limit, timeout, bad JSON) return a typed result to the UI and never overwrite saved advice.

### 8. Data model sketch

```
user, session, account, verification   (generated by Better Auth; ids are text;
                                        account holds the password hash;
                                        verification is unused in version one)

wallets     id, user_id, name, opening_balance, archived_at, created_at
categories  id, user_id, name, is_reserved, archived_at, created_at
loans       id, user_id, direction (borrowed|lent), counterparty, principal,
            due_date?, note?, created_at
entries     id, user_id, type, wallet_id, to_wallet_id?, category_id?, loan_id?,
            amount, entry_date, note?, created_at
settings    user_id (primary key), month_start_day, alerts_enabled, monthly_limit?
ai_advice   id, user_id, period_start, period_end, input_hash, payload (jsonb), created_at
ai_usage    user_id, day, count                    primary key (user_id, day)
login_attempts  id, email, attempted_at
```

Names are unique per user, ignoring case: `(user_id, lower(name))` for categories and for active wallets. `ai_advice` is unique on `(user_id, period_start)`. `login_attempts` is indexed on `(email, attempted_at)`.

### 9. ORM and database access
Drizzle ORM with Neon's serverless driver, and Drizzle migrations checked into the repo. It is light for serverless, keeps SQL visible for the aggregate queries, and types money columns explicitly.

Alternative: Prisma. Heavier cold starts and a bundled engine, with little benefit for this size.

### 10. Theme
`global.css` defines every colour in `@theme inline`, with a `:root` set and a `.dark` set. Version one is dark only: the app applies the dark set and has no theme switch. Components use only theme tokens. Charts take their colours from the same tokens.

### 11. Data isolation in two layers
A forgotten filter in one query would leak a friend's money, so isolation is enforced twice.

- **In the code:** every data function takes the user id that `requireUser()` returned, never one from the browser. Every read filters by `user_id`, and every update or delete matches on both the record id and `user_id`. A record that is not the user's behaves as not found.
- **In the database:** `wallets`, `categories` and `loans` each get a unique constraint on `(user_id, id)`. In `entries`, the wallet, destination wallet, category and loan references are composite foreign keys that include `user_id`. Postgres therefore rejects an entry that points at another user's wallet, category or loan, even if the code were wrong.
- **In the tests:** each data function is tested with two users in the in-memory database, proving that user B cannot read, change or reference user A's records.

Alternative: Postgres row-level security with a per-request setting. Stronger in theory, but awkward on pooled serverless connections and harder to test, so the composite keys plus scoped queries are used instead.

## Risks / Trade-offs

- [Public URL with open sign-up lets strangers register, store data and spend the shared Gemini quota] -> Set `ALLOWED_EMAILS` to the friends' addresses, limit advice to 5 requests per user per day, and handle rate-limit errors gracefully.
- [A coding slip leaks one user's data to another] -> Two-layer isolation (decision 11) and two-user tests for every data function.
- [The database owner can technically read every user's data] -> Tell friends. No notes or names go to Gemini. Nothing sensitive such as phone or account numbers is stored.
- [No password reset in version one] -> A forgotten password means that account cannot be recovered without the owner editing the database. A follow-up change can add email reset once an email service exists.
- [Someone can lock a friend out by guessing their email 5 times] -> The lock lasts only 15 minutes and does not reveal a password. Accepted for a small group.
- [Registration reveals whether an email is already registered] -> Accepted for a small group. Sign-in does not reveal it.
- [Auth library upgrades change its schema] -> Pin the version and review generated migrations.
- [Gemini free tier changes or rate limits] -> Model name in env, saved advice, skip unchanged requests, graceful errors.
- [Provider may train on free-tier prompts] -> Aggregates only, no free text, no names, no identity.
- [Balances recalculated on every render] -> Indexes; revisit only if volume grows far beyond personal use.
- [Month start day changes regroup history] -> Expected and documented. No entry data is modified.
- [Hard delete of loans removes history] -> Confirmation step; acceptable for a personal tool.

## Migration Plan

Fresh deployment with one change to the schema already applied to Neon. Create the Neon database from the Vercel Storage tab (Marketplace integration) in the Singapore region (`sin1`), and set the Vercel Function Region to Singapore (`sin1`) so code and database sit together. Vercel supplies `DATABASE_URL`; pull it locally with `vercel env pull .env.local`.

The first migration is already applied and holds only the old global seed rows (9 categories and 1 settings row, no user data). A new migration:
1. Deletes those global seed rows, because defaults are now created per user.
2. Adds the Better Auth tables.
3. Adds `user_id` (not null, referencing the user table) to wallets, categories, loans, entries, settings and ai_advice, with the composite keys from decision 11, and adds `ai_usage` and the `email` column on `login_attempts`.

Env values in Vercel and locally: `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash-lite`, `AUTH_SECRET`, `BETTER_AUTH_URL` (the production address; previews use the deployment address), and an optional `ALLOWED_EMAILS`. `APP_PASSWORD` is removed. Rollback is redeploying the previous build. Migrations are forward-only, so a bad one is fixed with a new migration.
