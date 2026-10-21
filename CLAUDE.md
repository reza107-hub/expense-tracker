# CLAUDE.md

Expense tracker for Bangladeshi users (cash, bank, bKash, Nagad, crypto, loans), with Gemini saving advice. Many users, each with private data. Next.js 16 on Vercel, Neon Postgres (Singapore), Drizzle, Better Auth. The plan lives in `openspec/changes/expense-tracker/` (proposal, specs, design, tasks). Read `tasks.md` for progress and `design.md` before changing architecture.

`AGENTS.md` says this Next.js has breaking changes. Read the matching guide in `node_modules/next/dist/docs/` before writing Next.js code.

## Commands

Package manager is **pnpm** (the user's alias is `pn`; scripts and non-interactive shells need `pnpm`).

```
pnpm dev                       # dev server
pnpm build                     # production build
pnpm lint && pnpm typecheck    # eslint, tsc --noEmit
pnpm test                      # all tests (vitest run)
pnpm exec vitest run src/lib/auth/lockout.test.ts          # one file
pnpm exec vitest run -t "locks after five"                 # one test by name
pnpm db:generate               # new migration from src/db/schema.ts
pnpm db:migrate                # apply migrations (uses DATABASE_URL_UNPOOLED, else DATABASE_URL)
```

`drizzle-kit generate` asks interactive questions when a column is added or renamed and fails without a TTY. Drive it through a pty (python `pty`) and hand-check the SQL.

Env comes from `vercel env pull .env.local`. Keys are listed in `.env.example`.

## Rules that are easy to break

- **Tests never touch real data.** They use in-memory PGlite via `src/test/db.ts`. `src/test/setup.ts` scrubs production env vars and blocks `fetch`, and `createDb` throws under Vitest. Never use Neon in a test. Never write to the live database to "verify" something. Reading it is fine. For browser checks, run a throwaway database (PGlite behind pglite-socket) and point `DATABASE_URL` at `localhost`, which switches the app to the `pg` driver.
- **Every Server Action and every data function must call `await requireUser()` first** and use the returned `userId` for every query. Never take a user id from the browser. `proxy.ts` only checks that a cookie exists and is not a security boundary. `src/test/protected-code.test.ts` fails if a function in `src/actions/` or `src/data/` forgets this.
- **Data isolation is enforced twice:** queries filter by `user_id`, and `entries` uses composite foreign keys `(user_id, wallet_id)` etc., so Postgres rejects cross-user references. Keep both when adding tables. Test each data function with two users.
- **No `/api` routes.** Reads are Server Components, writes are Server Actions. Better Auth is used through `auth.api.*` (see `src/lib/auth/auth.ts`) and its HTTP handler is never mounted. If a flow seems to need the handler, stop and ask.
- **Money is integer poisha** (1 taka = 100), never floats. Use `src/lib/money.ts` to parse and format (lakh grouping, `1,00,000`).
- **Wallet balances are never stored.** They are calculated from the `entries` ledger (opening balance plus signed effects). Loan repayments and fees are separate ledger rows. Multi-row writes use one transaction.
- **Dates are `YYYY-MM-DD` strings.** "Today" and report months use Asia/Dhaka via `src/lib/period.ts`. Each user has a month start day (1 to 28).
- **Gemini gets aggregates only** (category totals), never notes, wallet or counterparty names, emails or ids. SQL does the maths, Gemini only explains. Each user is limited to 5 fresh requests a day (task 10.8).

## Next.js 16 specifics in this repo

- `cacheComponents` is on. Anything that reads cookies or headers (`requireUser`, `currentUserId`) must render behind `<Suspense>`, and must read `headers()` before touching the database or auth, or the build tries to prerender it and fails on missing env.
- The route guard is `src/proxy.ts` (renamed from middleware). It never redirects away from `/sign-in` or `/register`, because a stale cookie would loop. Those pages call `RedirectIfSignedIn` instead.
- Colours come only from theme variables in `src/app/globals.css`. The app is dark only for now.

## Auth and database notes

- `createAuth` takes a `db`, so tests and the app share it. Hooks in `auth.ts` do the allow-list (`ALLOWED_EMAILS`), per-user default seeding, and the per-email sign-in lock (`lockout.ts`, 5 attempts in 15 minutes).
- `requireUser()` also repairs an account whose defaults are missing (`ensureUserDefaults`).
- Migrations are forward-only. `drizzle/0002_*` is hand-edited (guard plus ordering). Hand-edit with care and re-run `src/db/ownership.test.ts`.

## Environment gotcha

The project folder is on an **NTFS drive**. `pnpm build` there can fail with "Module not found" for installed packages after other commands have run, and passes on a normal Linux filesystem. `pnpm-workspace.yaml` sets `nodeLinker: hoisted` (real folders, no symlinks) to avoid this in `pnpm dev`. If it returns, run `rm -rf node_modules .next && pnpm install --frozen-lockfile`, or move the project to a Linux drive. To verify a build reliably, rsync the project (excluding `node_modules`, `.next*`, `.claude`, `openspec`) to a folder under `/tmp`, install, and build there. Vercel builds are not affected. Never run `pkill -f "next"`, because it can match your own shell. Kill by recorded pid or port.

## Working with the user

- Follow the `openspec` workflow: update planning files first when scope changes, then implement, and tick tasks in `tasks.md` only when their verification has really run.
- Confirm before changing the plan's intent. An earlier single-password login was built without being asked and had to be replaced by accounts.
- Pushing is to `git@github.com:reza107-hub/expense-tracker.git` (SSH). Commit only when asked.

## Browser QA

Use `playwright-cli` (skill in `.claude/skills/playwright-cli/`) for browser automation and UI testing, only when the user asks or grants permission. Run it as `playwright-cli` or `npx playwright`. Never use Playwright MCP.

1. Start or verify the dev server, then open the app with `playwright-cli`.
2. Inspect with snapshots and act through element refs. Verify the result after each important action.
3. Take screenshots when useful, especially for failures. Save them under `qa/screenshots/` and keep them until the QA report is done.
4. Report failures with reproduction steps. Do not change app code during QA unless asked to fix a found issue.
5. At the end of every QA run (unless asked to keep them): delete the images inside `qa/screenshots/` (keep `qa/` and `.gitkeep`), remove `.playwright-cli/`, and delete other temporary Playwright artifacts. Never leave before/after screenshots as a record. Describe results in chat.
