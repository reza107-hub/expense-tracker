## Why

People in Bangladesh keep money across cash, a bank, bKash, Nagad and crypto. There is no one place to see how much is spent each month or where to cut back. bKash and bank apps expose no personal API, so spending must be entered by hand. An AI layer can then turn the monthly totals into plain saving advice. The owner will share the app with friends, so each person needs their own account and their own private data.

## What Changes

- New Next.js web app (App Router), dark themed and responsive, deployed on Vercel.
- All writes use Server Actions and all reads use Server Components. No API route handlers.
- PostgreSQL on a hosted provider (Neon). Env file lists blank keys: `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AUTH_SECRET`, `BETTER_AUTH_URL`, and an optional `ALLOWED_EMAILS`.
- Accounts: register and sign in with an email and a password. A long-lived cookie keeps the user signed in. Sign-up is open unless `ALLOWED_EMAILS` is set, in which case only those emails may register. Version one has no email verification and no forgot-password.
- Every record (wallets, categories, entries, loans, settings, saved advice) belongs to one user. A user can only see and change their own data.
- Each new account starts with the default categories and default settings. It has no wallets.
- Wallets: each user creates any number of wallets (presets: Cash, Bank, bKash, Nagad, Rocket, Upay, Crypto, or a custom name) with an opening balance. No phone or account numbers are stored.
- Entries: expense, income, transfer between wallets, and balance adjustment (for crypto value changes). Every entry names a wallet. A low balance warns but does not block.
- Wallet balance is calculated from entries. It is never stored.
- Categories: a default list plus user-defined ones. Categories are archived, never deleted.
- Loans: borrowed or lent, with counterparty name, amount, wallet, date, optional due date and optional interest or fee. Repayments move wallet balances but are not spending. Interest and fees count as expenses.
- Monthly reports based on a month start day (default the 1st, changeable in each user's settings).
- One total monthly spending limit per user, across all of that user's wallets. Alerts are off until the user turns them on, and show in the web app only, at 80% and when exceeded. Loan due-date alerts are computed when the app is opened.
- Gemini (free model) gets category totals only, never notes or names, and returns saving suggestions. The result is saved per user and month and refreshed on request. Fresh requests are limited per user per day, because the free tier is shared by everyone.

## Capabilities

### New Capabilities
- `app-access`: registration and sign-in with email and password, persistent sessions, per-email sign-in lock, optional sign-up allow-list, and private per-user data.
- `wallets`: create, rename, archive wallets; opening balance; calculated balance.
- `transactions`: expense, income, transfer and balance adjustment entries; edit and delete.
- `categories`: default and custom categories; archive instead of delete.
- `loans`: borrowed and lent loans, repayments, interest or fees, due dates, owed totals.
- `monthly-reports`: month-based totals by category and wallet, net position, month start setting.
- `spending-alerts`: opt-in total monthly limit alert, 80% warning, loan due-date alert, in-app only.
- `ai-spending-advice`: Gemini suggestions from category totals, saved per month, refreshed on demand.

### Modified Capabilities
None. The project has no existing specs.

## Impact

- New project: Next.js, TypeScript, Tailwind with theme variables in `global.css`, Lucide icons, an ORM with the Neon serverless driver, Better Auth for accounts, and the Google Gemini SDK.
- New external services: Neon PostgreSQL, Gemini API (free tier, rate limited, shared by all users), Vercel hosting.
- Privacy: the Gemini free tier may use prompts to improve Google products, so only aggregated totals are sent, never emails, names or notes. The owner of the database can technically read every user's data, which friends should be told.
- Existing work: the schema, money helpers, month logic, theme and app shell stay. The single-password login, its lock table and `APP_PASSWORD` are replaced.
- Non-goals for version one: importing SMS, screenshots or statements, live crypto prices, email or push alerts, background jobs, email verification, forgot-password, social sign-in, admin screens, deleting an account.
