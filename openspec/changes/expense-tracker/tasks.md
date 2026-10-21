## Phase 1: Foundation

## 1. Project setup

- [x] 1.1 Create the Next.js App Router project with TypeScript and Tailwind, and verify `npm run dev` serves a page
- [x] 1.2 Add dependencies (Drizzle ORM, Neon serverless driver, Zod, Gemini SDK, a signing library for cookies, Lucide, a test runner) and verify `npm install` and `npm run build` succeed
- [x] 1.3 Add `.env.example` with blank `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `APP_PASSWORD`, `AUTH_SECRET`, and verify `.env*` files other than the example are git-ignored (the auth keys are replaced in 3.9)
- [x] 1.4 Define all colours in `global.css` using `@theme inline`, with `:root` and `.dark` sets and dark applied by default, and verify no hardcoded Tailwind colour classes exist (search for `text-white`, `bg-black`, `border-gray-`)
- [x] 1.5 Build the base layout with a responsive shell (bottom navigation on phones, sidebar on wide screens) using Lucide icons, and verify it at 360px and 1280px widths with no sideways scroll

## 2. Database and money helpers

- [x] 2.1 Define the first schema for wallets, categories, entries, loans, settings, ai_advice and login_attempts, with unique `lower(name)` indexes and indexes on `entries(wallet_id)` and `entries(entry_date)`, and verify the migration applies to a fresh Neon database (made per-user in 3.2)
- [x] 2.2 Replace the global seed with a per-user step that creates the default categories, the reserved "Loan interest and fees" category and the settings row (start day 1, alerts off) for one user id, and verify running it twice for one user creates no duplicates and two users each get their own separate copy
- [x] 2.3 Implement poisha helpers (parse a decimal string with at most two places, format as taka) and verify unit tests cover rounding, zero, negative, three decimals and large values
- [x] 2.4 Implement the period function `(date, startDay) -> start, end` in Asia/Dhaka and verify unit tests cover start day 1, start day 25, year boundaries and February

## Phase 2: Accounts and data isolation

## 3. Accounts

- [x] 3.1 Install Better Auth and configure it with the Drizzle adapter for email and password (8 to 128 characters, no verification, signed in after registering, 90-day database sessions, cookie cache off) and its Next.js cookie plugin, with no `/api/auth` route handler, and generate its tables into the schema. Verify with a PGlite test that registering creates a user whose stored password is a hash, that emails are stored trimmed and lower case, that a duplicate email in another letter case is rejected, and that `pnpm build` lists no API route
- [x] 3.2 Add ownership to the data schema in a new migration: delete the old global seed rows, then add a not-null `user_id` to wallets, categories, loans, entries, settings (primary key) and ai_advice, per-user unique names, `(user_id, id)` unique keys with composite foreign keys from entries, an `ai_usage` table, and an `email` column on `login_attempts`. Verify the migration applies to the Neon database, and that PGlite constraint tests reject an entry pointing at another user's wallet, category or loan and accept the same names in two accounts
- [x] 3.3 Add the per-email sign-in lock: a hook before the sign-in step that takes an advisory lock on the email, refuses when 5 attempts fall within 15 minutes, otherwise records an attempt, and a hook after success that clears that email's attempts. Verify with PGlite tests that the correct password is refused during the lock and accepted after 15 minutes, that another email is unaffected, that an unknown email locks the same way, that success clears the count, and that 12 parallel guesses for one email allow only 5 attempts
- [x] 3.4 Add the sign-up hooks: reject registration when `ALLOWED_EMAILS` is set and the email is not on it (case-insensitive), and create the default categories and settings for each new user. Verify with tests for open sign-up, an allowed email, a blocked email creating no account, and two users getting separate defaults
- [x] 3.5 Implement `requireUser()`, which validates the session against the database and returns the user id (redirecting to sign-in otherwise and making sure the user's defaults exist), and update the proxy to redirect page visits that have no session cookie. Verify that an action calling `requireUser()` without a valid session changes nothing, that forged, expired and signed-out sessions are refused, and update the guard test so every function in `src/actions` and `src/data` must call it
- [x] 3.6 Build the registration page and Server Action (email, password, confirm password) with clear field errors, and verify each `app-access` registration scenario including mismatched passwords, a weak password, a duplicate email and a blocked email
- [x] 3.7 Build the sign-in page and Server Action with one generic "incorrect email or password" message and the lock message, and verify the correct, wrong-password, unknown-email and locked scenarios
- [x] 3.8 Add sign-out to the shell and make the sign-in and registration pages send signed-in users to the dashboard, and verify in a browser that sign-out ends the session and that every page redirects to sign-in afterwards
- [x] 3.9 Remove the single-password code (the shared password, the cookie-signing and global lock code, and their tests), and update `.env.example` to `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AUTH_SECRET`, `BETTER_AUTH_URL` and an optional `ALLOWED_EMAILS` with blank values. Verify by searching that `APP_PASSWORD` no longer appears in the source
- [x] 3.10 Add a two-user test helper, and verify in a real browser with two accounts that each has a separate session and their own default categories, that signing one out leaves the other signed in, and that a session survives a reload and a second tab. Data isolation is proven at the database level in 3.2, and in the browser for wallets in 4.2

## Phase 3: Core money features

Every data function below takes the user id from `requireUser()` and is tested with two users: user B cannot read, change, delete or reference user A's records.

## 4. Wallets

- [ ] 4.1 Implement the wallet data layer with a calculated balance query scoped to the signed-in user, and verify unit tests for expense, income, transfer, adjustment, loan and deletion effects, and that another user's entries never change a balance
- [ ] 4.2 Build the wallets page with create (presets or custom name, opening balance), rename, edit opening balance, archive (blocked unless balance is zero) and restore, and verify each `wallets` scenario including the duplicate-name rejection within one user and the same name in two users, and verify in a real browser with two accounts that each sees only their own wallets
- [ ] 4.3 Confirm no form asks for a phone number, account number or credential, and verify by reading the wallet form fields

## 5. Categories

- [ ] 5.1 Implement the category data layer and page with add, rename, archive and restore, and verify duplicates are rejected ignoring case within one user and that one user's changes never show for another
- [ ] 5.2 Hide the reserved loan category from expense forms and block its archiving, and verify both in the UI

## 6. Transactions

- [ ] 6.1 Implement Server Actions for expense, income, transfer and adjustment with schema validation (amount above zero, two decimals, no future date, different wallets for transfer, wallet and category owned by the user), and verify unit tests for each rejection
- [ ] 6.2 Build the add-entry forms where the wallet is chosen on every entry, and verify an expense from bKash lowers only the bKash balance
- [ ] 6.3 Add the low-balance warning with a confirm step, and verify confirming saves a negative balance and cancelling saves nothing
- [ ] 6.4 Build the entry list for a month with newest-first order and wallet and category filters, and verify filters against seeded data and that only the user's own entries appear
- [ ] 6.5 Add edit and delete for entries, and verify balances and totals update after each

## 7. Loans

- [ ] 7.1 Implement loan creation for "I borrowed" and "I lent", writing the principal entry in one transaction, and verify wallet effects and that spending is unchanged
- [ ] 7.2 Implement repayments with principal, optional interest or fee, and overpayment rejection, writing both rows in one transaction, and verify the borrowed-fee and lent-interest scenarios
- [ ] 7.3 Build the loans page with original, repaid and outstanding amounts and open or closed status, and verify a final repayment closes the loan and deleting it reopens the loan
- [ ] 7.4 Add loan edit (counterparty, due date, note) and delete with confirmation, and verify delete removes repayments and their wallet and spending effects
- [ ] 7.5 Confirm loan forms hold only a name, never a phone or account number, and verify by reading the form fields

## Phase 4: Reports and alerts

## 8. Settings and reports

- [ ] 8.1 Build the settings page for each user's month start day (1 to 28) and verify 31 is rejected, changing the day regroups reports without altering entries, and one user's day does not change another's
- [ ] 8.2 Implement the monthly report queries (spending total, by category with shares, by wallet, previous-month comparison, six-month trend) for the signed-in user, and verify unit tests against the `monthly-reports` scenarios, including "only expenses counted" and that another user's entries are excluded
- [ ] 8.3 Build the dashboard (wallet cards, total balance, owed and owed-to-you, net position, month spending) and verify the 48,200 / 40,000 / 8,200 example
- [ ] 8.4 Build the report page with a month picker, theme-token charts and the empty state, and verify an empty month shows no errors and no misleading percentages

## 9. Alerts

- [ ] 9.1 Add the alerts toggle and monthly limit to each user's settings, and verify enabling without a limit is refused
- [ ] 9.2 Compute and render limit alerts at 80% and above 100% from the user's total spending across all their wallets, and verify the bKash plus Bank example exceeds a 30,000 limit
- [ ] 9.3 Compute and render loan due alerts (overdue or due within 7 days, open loans only, different wording for borrowed and lent), and verify a closed loan shows none
- [ ] 9.4 Verify no alert shows while alerts are off, that deleting an expense clears an alert, that a new month starts clean, and that one user's alert settings never affect another user

## Phase 5: AI advice

## 10. Gemini advice

- [ ] 10.1 Build the aggregate payload builder (category totals for this and the previous month, total, limit, total owed, loan fees) from the signed-in user's data, and verify a test that notes, wallet names, counterparty names, emails and user ids never appear in the payload
- [ ] 10.2 Implement the Gemini call with structured JSON output and the model name from env, and verify against the live free tier with a seeded month
- [ ] 10.3 Validate the response and drop suggestions whose saving exceeds the category's spend, and verify a unit test for the 5,000 over 3,000 case
- [ ] 10.4 Save advice per user and month with an input hash, reuse it on return, and skip the call when a refresh finds the same hash, and verify no request is made in those two cases and that users only see their own advice
- [ ] 10.5 Handle rate limit, timeout and invalid responses with a clear message that keeps old advice, and verify by forcing each failure
- [ ] 10.6 Build the advice UI with a refresh button, creation time and an empty-month message, and verify an empty month makes no request
- [ ] 10.7 Verify the Gemini key is absent from the built client bundle by searching the `.next` output
- [ ] 10.8 Limit each user to 5 requests per day in Bangladesh time, counted before the call and returned when the call fails, and verify the sixth request makes no call, reused advice does not count, a failed call does not use up the allowance, and another user is unaffected

## Phase 6: Release

## 11. Quality and deploy

- [ ] 11.1 Run `npm run lint`, type checks and the test suite, and verify all pass
- [ ] 11.2 Walk through every spec scenario on a phone-sized screen with two accounts, and verify the list has no failures
- [ ] 11.3 Confirm there are no emojis or hardcoded colour classes in the source by searching the code
- [ ] 11.4 Deploy to Vercel with the env values set (including `BETTER_AUTH_URL` and `ALLOWED_EMAILS`) and migrations run, and verify on the live URL that two accounts can register, that each sees only their own data, that sign-in works after a reload, and that advice works
