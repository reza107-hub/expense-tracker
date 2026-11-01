import { APIError } from "better-auth/api";
import { ensureUserDefaults } from "@/db/seed";
import type { AnyDb } from "@/db/types";
import { buildAdvicePayload, hashPayload } from "@/lib/advice/payload";
import { describeOutcome } from "@/lib/advice/describe";
import type { AdviceClient } from "@/lib/advice/gemini";
import { getSavedAdvice, requestAdvice } from "@/lib/advice/service";
import { DAILY_LIMIT, remainingRequests } from "@/lib/advice/usage";
import { getAlerts } from "@/lib/alerts/compute";
import { EMAIL_NOT_ALLOWED, SIGN_IN_LOCKED, type Auth } from "@/lib/auth/auth";
import { AuthConfigError } from "@/lib/auth/env";
import { readSignIn, validateRegistration } from "@/lib/auth/validation";
import { archiveCategory, createCategory, renameCategory, restoreCategory } from "@/lib/categories/mutations";
import type { CategoryResult } from "@/lib/categories/mutations";
import { listCategories } from "@/lib/categories/queries";
import { validateCategory } from "@/lib/categories/validation";
import { createEntry } from "@/lib/entries/create";
import { listEntries } from "@/lib/entries/list";
import { deleteEntry, findPlainEntryType, updateEntry } from "@/lib/entries/modify";
import { parseEntriesQuery } from "@/lib/entries/query-params";
import { validateEntry, validateEntryChanges, type EntryType } from "@/lib/entries/validation";
import {
  createLoan,
  deleteLoan,
  deleteRepayment,
  recordRepayment,
  updateLoan,
} from "@/lib/loans/mutations";
import { listLoans, listRepayments, loanTotals } from "@/lib/loans/queries";
import { validateLoan, validateLoanEdit, validateRepayment } from "@/lib/loans/validation";
import { periodContaining, periodForMonth, todayInDhaka } from "@/lib/period";
import { getOverview } from "@/lib/reports/overview";
import { getMonthReport } from "@/lib/reports/queries";
import { updateAlertSettings, updateMonthStartDay } from "@/lib/settings/mutations";
import { getAlertSettings, getMonthStartDay } from "@/lib/settings/queries";
import { validateAlertSettings, validateMonthStartDay } from "@/lib/settings/validation";
import {
  archiveWallet,
  createWallet,
  restoreWallet,
  updateWallet,
  type WalletResult,
} from "@/lib/wallets/mutations";
import { listWalletsWithBalance, totalBalance } from "@/lib/wallets/queries";
import { validateWallet } from "@/lib/wallets/validation";
import {
  ApiError,
  errorResponse,
  invalid,
  json,
  notFound,
  readBody,
  toFormData,
} from "./http";

export type ApiDeps = {
  db: AnyDb;
  /** Created lazily, because reading the environment can fail. */
  getAuth: () => Auth;
  /** Null when no Gemini key is set. */
  adviceClient: () => AdviceClient | null;
  now?: () => Date;
};

type Ctx = {
  db: AnyDb;
  auth: Auth;
  request: Request;
  userId: string;
  email: string;
  today: string;
  params: string[];
  query: URLSearchParams;
  body: Record<string, unknown>;
  adviceClient: () => AdviceClient | null;
};

type PublicCtx = Omit<Ctx, "userId" | "email">;

type Route =
  | { method: string; pattern: RegExp; public: true; handler: (ctx: PublicCtx) => Promise<Response> }
  | { method: string; pattern: RegExp; public?: false; handler: (ctx: Ctx) => Promise<Response> };

const ID = "([0-9]{1,9})";
const path = (template: string) => new RegExp(`^${template.replace(/:id/g, ID)}$`);
const id = (ctx: { params: string[] }) => Number(ctx.params[0]);

const WALLET_DUPLICATE = "You already have a wallet with this name.";
const CATEGORY_MESSAGES = {
  "duplicate-name": "You already have a category with this name.",
  "not-found": "This category no longer exists. Refresh and try again.",
  reserved: "This category is used for loan interest and fees, so it cannot be archived.",
} as const;

function walletFailure(result: Extract<WalletResult, { ok: false }>): ApiError {
  if (result.reason === "duplicate-name") {
    return new ApiError(409, "DUPLICATE_NAME", WALLET_DUPLICATE, {
      fieldErrors: { name: WALLET_DUPLICATE },
    });
  }
  if (result.reason === "balance-not-zero") {
    return new ApiError(409, "BALANCE_NOT_ZERO", result.message);
  }
  return notFound("This wallet no longer exists. Refresh and try again.");
}

function categoryFailure(result: Extract<CategoryResult, { ok: false }>): ApiError {
  const message = CATEGORY_MESSAGES[result.reason];
  if (result.reason === "duplicate-name") {
    return new ApiError(409, "DUPLICATE_NAME", message, { fieldErrors: { name: message } });
  }
  return result.reason === "reserved"
    ? new ApiError(409, "RESERVED", message)
    : notFound(message);
}

/** Sends the signed-in user's own messages for an entry that needs the low-balance confirmation. */
const lowBalance = (low: { walletName: string; balanceAfter: number }) =>
  new ApiError(
    409,
    "LOW_BALANCE",
    `This would take ${low.walletName} below zero. Send again with confirmLowBalance: true to continue.`,
    { walletName: low.walletName, balanceAfter: low.balanceAfter },
  );

const monthFrom = (query: URLSearchParams) =>
  parseEntriesQuery(Object.fromEntries(query)).month;

async function periodFor(ctx: Ctx, month: { year: number; month: number } | null) {
  const startDay = await getMonthStartDay(ctx.db, ctx.userId);
  const period = month
    ? periodForMonth(month.year, month.month, startDay)
    : periodContaining(ctx.today, startDay);
  return { startDay, period };
}

const ENTRY_TYPES: readonly string[] = ["expense", "income", "transfer", "adjustment"];

const ok = (data: unknown = { ok: true }, status = 200) => json(data, status);

/** Whether the person is allowed in. Sign-in and sign-up are the only routes without a token. */
function authFailure(error: unknown): ApiError {
  if (error instanceof APIError) {
    const body = error.body as { code?: string; retryAfterSeconds?: number } | undefined;
    const code = body?.code;
    if (code === SIGN_IN_LOCKED) {
      return new ApiError(429, "SIGN_IN_LOCKED", "Too many sign-in attempts. Try again later.", {
        retryAfterSeconds: body?.retryAfterSeconds ?? 900,
      });
    }
    if (code === EMAIL_NOT_ALLOWED) {
      return invalid({ email: "This email is not allowed to register." });
    }
    if (code?.startsWith("USER_ALREADY_EXISTS")) {
      return new ApiError(409, "EMAIL_TAKEN", "This email is already registered. Sign in instead.", {
        fieldErrors: { email: "This email is already registered. Sign in instead." },
      });
    }
    return new ApiError(401, "INVALID_CREDENTIALS", "The email or password is not right.");
  }
  throw error;
}

function session(response: { user: { id: string; email: string; name: string } }, headers: Headers) {
  const token = headers.get("set-auth-token");
  if (!token) throw new Error("The account system did not return a session token.");
  const { id, email, name } = response.user;
  return { token, user: { id, email, name } };
}

export const routes: Route[] = [
  // ---- Account ----
  {
    method: "POST",
    pattern: path("/auth/sign-in"),
    public: true,
    async handler({ auth, request, body }) {
      const { input } = readSignIn(toFormData(body));
      if (!input) throw invalid({ email: "Enter your email and password." });
      try {
        const { headers, response } = await auth.api.signInEmail({
          body: input,
          headers: request.headers,
          returnHeaders: true,
        });
        return ok(session(response, headers));
      } catch (error) {
        throw authFailure(error);
      }
    },
  },
  {
    method: "POST",
    pattern: path("/auth/register"),
    public: true,
    async handler({ auth, request, body }) {
      const checked = validateRegistration(toFormData(body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      const { email, password } = checked.value;
      try {
        const { headers, response } = await auth.api.signUpEmail({
          body: { name: email.split("@")[0], email, password },
          headers: request.headers,
          returnHeaders: true,
        });
        return ok(session(response, headers), 201);
      } catch (error) {
        throw authFailure(error);
      }
    },
  },
  {
    method: "POST",
    pattern: path("/auth/sign-out"),
    async handler({ auth, request }) {
      try {
        await auth.api.signOut({ headers: request.headers });
      } catch {
        // Already signed out. The app clears its own token either way.
      }
      return ok();
    },
  },
  {
    method: "GET",
    pattern: path("/me"),
    async handler({ userId, email }) {
      return ok({ user: { id: userId, email } });
    },
  },

  // ---- Home ----
  {
    method: "GET",
    pattern: path("/dashboard"),
    async handler({ db, userId, today }) {
      const [overview, alerts] = await Promise.all([
        getOverview(db, userId, today),
        getAlerts(db, userId, today),
      ]);
      return ok({ overview, alerts });
    },
  },

  // ---- Wallets ----
  {
    method: "GET",
    pattern: path("/wallets"),
    async handler({ db, userId }) {
      const [active, archived, total] = await Promise.all([
        listWalletsWithBalance(db, userId),
        listWalletsWithBalance(db, userId, { archived: true }),
        totalBalance(db, userId),
      ]);
      return ok({ active, archived, total });
    },
  },
  {
    method: "POST",
    pattern: path("/wallets"),
    async handler({ db, userId, body }) {
      const checked = validateWallet(toFormData(body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      const result = await createWallet(db, userId, checked.value);
      if (!result.ok) throw walletFailure(result);
      return ok(undefined, 201);
    },
  },
  {
    method: "PUT",
    pattern: path("/wallets/:id"),
    async handler(ctx) {
      const checked = validateWallet(toFormData(ctx.body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      const result = await updateWallet(ctx.db, ctx.userId, id(ctx), checked.value);
      if (!result.ok) throw walletFailure(result);
      return ok();
    },
  },
  {
    method: "POST",
    pattern: path("/wallets/:id/archive"),
    async handler(ctx) {
      const result = await archiveWallet(ctx.db, ctx.userId, id(ctx));
      if (!result.ok) throw walletFailure(result);
      return ok();
    },
  },
  {
    method: "POST",
    pattern: path("/wallets/:id/restore"),
    async handler(ctx) {
      const result = await restoreWallet(ctx.db, ctx.userId, id(ctx));
      if (!result.ok) throw walletFailure(result);
      return ok();
    },
  },

  // ---- Categories ----
  {
    method: "GET",
    pattern: path("/categories"),
    async handler({ db, userId }) {
      const [active, archived] = await Promise.all([
        listCategories(db, userId),
        listCategories(db, userId, { archived: true }),
      ]);
      return ok({ active, archived });
    },
  },
  {
    method: "POST",
    pattern: path("/categories"),
    async handler({ db, userId, body }) {
      const checked = validateCategory(toFormData(body));
      if (!checked.ok) throw invalid({ name: checked.fieldError });
      const result = await createCategory(db, userId, checked.name);
      if (!result.ok) throw categoryFailure(result);
      return ok(undefined, 201);
    },
  },
  {
    method: "PUT",
    pattern: path("/categories/:id"),
    async handler(ctx) {
      const checked = validateCategory(toFormData(ctx.body));
      if (!checked.ok) throw invalid({ name: checked.fieldError });
      const result = await renameCategory(ctx.db, ctx.userId, id(ctx), checked.name);
      if (!result.ok) throw categoryFailure(result);
      return ok();
    },
  },
  {
    method: "POST",
    pattern: path("/categories/:id/archive"),
    async handler(ctx) {
      const result = await archiveCategory(ctx.db, ctx.userId, id(ctx));
      if (!result.ok) throw categoryFailure(result);
      return ok();
    },
  },
  {
    method: "POST",
    pattern: path("/categories/:id/restore"),
    async handler(ctx) {
      const result = await restoreCategory(ctx.db, ctx.userId, id(ctx));
      if (!result.ok) throw categoryFailure(result);
      return ok();
    },
  },

  // ---- Entries ----
  {
    method: "GET",
    pattern: path("/entries"),
    async handler(ctx) {
      const query = parseEntriesQuery(Object.fromEntries(ctx.query));
      const { startDay, period } = await periodFor(ctx, query.month);
      const { db, userId } = ctx;
      const [entries, aw, xw, ac, xc] = await Promise.all([
        listEntries(db, userId, period, query),
        listWalletsWithBalance(db, userId),
        listWalletsWithBalance(db, userId, { archived: true }),
        listCategories(db, userId),
        listCategories(db, userId, { archived: true }),
      ]);
      return ok({
        period,
        today: ctx.today,
        startDay,
        entries,
        wallets: [
          ...aw.map(({ id, name }) => ({ id, name, archived: false })),
          ...xw.map(({ id, name }) => ({ id, name, archived: true })),
        ],
        categories: [
          ...ac.map(({ id, name, isReserved }) => ({ id, name, archived: false, reserved: isReserved })),
          ...xc.map(({ id, name, isReserved }) => ({ id, name, archived: true, reserved: isReserved })),
        ],
      });
    },
  },
  {
    method: "POST",
    pattern: path("/entries"),
    async handler({ db, userId, body }) {
      const type = String(body.type ?? "");
      if (!ENTRY_TYPES.includes(type)) {
        throw invalid({ type: "Choose expense, income, transfer or adjustment." });
      }
      const checked = validateEntry(type as EntryType, toFormData(body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      const result = await createEntry(db, userId, checked.value, {
        confirmLowBalance: body.confirmLowBalance === true,
      });
      if (result.ok) return ok({ id: result.id }, 201);
      if ("lowBalance" in result) throw lowBalance(result.lowBalance);
      throw invalid(result.fieldErrors);
    },
  },
  {
    method: "PUT",
    pattern: path("/entries/:id"),
    async handler(ctx) {
      // The type comes from the saved entry, never from the app.
      const type = await findPlainEntryType(ctx.db, ctx.userId, id(ctx));
      if (!type) throw notFound("This entry no longer exists, or is managed on the Loans page.");
      const checked = validateEntryChanges(type, toFormData(ctx.body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      const result = await updateEntry(ctx.db, ctx.userId, id(ctx), checked.value, {
        confirmLowBalance: ctx.body.confirmLowBalance === true,
      });
      if (result.ok) return ok();
      if ("lowBalance" in result) throw lowBalance(result.lowBalance);
      if ("fieldErrors" in result) throw invalid(result.fieldErrors);
      throw notFound("This entry no longer exists, or is managed on the Loans page.");
    },
  },
  {
    method: "DELETE",
    pattern: path("/entries/:id"),
    async handler(ctx) {
      const result = await deleteEntry(ctx.db, ctx.userId, id(ctx));
      if (!result.ok) throw notFound("This entry no longer exists, or is managed on the Loans page.");
      return ok();
    },
  },

  // ---- Loans ----
  {
    method: "GET",
    pattern: path("/loans"),
    async handler({ db, userId, today }) {
      const [loans, wallets, totals] = await Promise.all([
        listLoans(db, userId),
        listWalletsWithBalance(db, userId),
        loanTotals(db, userId),
      ]);
      const repayments = await listRepayments(db, userId, loans.map((loan) => loan.id));
      return ok({
        loans,
        repayments,
        wallets: wallets.map(({ id, name, balance }) => ({ id, name, balance })),
        totals,
        today,
      });
    },
  },
  {
    method: "POST",
    pattern: path("/loans"),
    async handler({ db, userId, body }) {
      const checked = validateLoan(toFormData(body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      const result = await createLoan(db, userId, checked.value);
      if (!result.ok) throw invalid(result.fieldErrors);
      return ok({ id: result.id }, 201);
    },
  },
  {
    method: "PUT",
    pattern: path("/loans/:id"),
    async handler(ctx) {
      const checked = validateLoanEdit(toFormData(ctx.body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      const result = await updateLoan(ctx.db, ctx.userId, id(ctx), checked.value);
      if (!result.ok) throw notFound("This loan no longer exists. Refresh and try again.");
      return ok();
    },
  },
  {
    method: "DELETE",
    pattern: path("/loans/:id"),
    async handler(ctx) {
      const result = await deleteLoan(ctx.db, ctx.userId, id(ctx));
      if (!result.ok) throw notFound("This loan no longer exists. Refresh and try again.");
      return ok();
    },
  },
  {
    method: "POST",
    pattern: path("/loans/:id/repayments"),
    async handler(ctx) {
      const checked = validateRepayment(toFormData(ctx.body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      const result = await recordRepayment(ctx.db, ctx.userId, id(ctx), checked.value);
      if (result.ok) return ok(undefined, 201);
      if ("fieldErrors" in result) throw invalid(result.fieldErrors);
      throw notFound("This loan no longer exists. Refresh and try again.");
    },
  },
  {
    method: "DELETE",
    pattern: path("/repayments/:id"),
    async handler(ctx) {
      const result = await deleteRepayment(ctx.db, ctx.userId, id(ctx));
      if (!result.ok) throw notFound("This repayment no longer exists. Refresh and try again.");
      return ok();
    },
  },

  // ---- Reports ----
  {
    method: "GET",
    pattern: path("/reports"),
    async handler(ctx) {
      const { startDay, period } = await periodFor(ctx, monthFrom(ctx.query));
      const report = await getMonthReport(ctx.db, ctx.userId, period, startDay);
      return ok({ startDay, today: ctx.today, report });
    },
  },

  // ---- Settings ----
  {
    method: "GET",
    pattern: path("/settings"),
    async handler({ db, userId }) {
      const [monthStartDay, alerts] = await Promise.all([
        getMonthStartDay(db, userId),
        getAlertSettings(db, userId),
      ]);
      return ok({ monthStartDay, ...alerts });
    },
  },
  {
    method: "PUT",
    pattern: path("/settings/month-start-day"),
    async handler({ db, userId, body }) {
      const checked = validateMonthStartDay(toFormData(body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      await updateMonthStartDay(db, userId, checked.value.monthStartDay);
      return ok();
    },
  },
  {
    method: "PUT",
    pattern: path("/settings/alerts"),
    async handler({ db, userId, body }) {
      const checked = validateAlertSettings(toFormData(body));
      if (!checked.ok) throw invalid(checked.fieldErrors);
      await updateAlertSettings(db, userId, checked.value);
      return ok();
    },
  },

  // ---- Advice ----
  {
    method: "GET",
    pattern: path("/advice"),
    async handler(ctx) {
      const { db, userId, today } = ctx;
      const { startDay, period } = await periodFor(ctx, monthFrom(ctx.query));
      const [saved, payload, remaining] = await Promise.all([
        getSavedAdvice(db, userId, period),
        buildAdvicePayload(db, userId, period, startDay),
        remainingRequests(db, userId, today),
      ]);
      return ok({
        period,
        saved: saved ? { advice: saved.advice, createdAt: saved.createdAt.toISOString() } : null,
        stale: saved ? saved.inputHash !== hashPayload(payload) : false,
        hasExpenses: payload.totalSpending > 0,
        remaining,
        dailyLimit: DAILY_LIMIT,
      });
    },
  },
  {
    method: "POST",
    pattern: path("/advice/refresh"),
    async handler(ctx) {
      const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(ctx.body.month ?? ""));
      if (!match) throw invalid({ month: "That month is not valid." });
      const startDay = await getMonthStartDay(ctx.db, ctx.userId);
      const outcome = await requestAdvice(ctx.db, ctx.userId, {
        period: periodForMonth(Number(match[1]), Number(match[2]), startDay),
        startDay,
        today: ctx.today,
        client: ctx.adviceClient(),
      });
      return ok({ status: outcome.status, message: describeOutcome(outcome) });
    },
  },
];

/** Prefix of every API address. */
export const API_BASE = "/api/v1";

/**
 * Answers one API request. Everything except sign-in and register needs a valid session
 * token, and the user id always comes from that session, never from the request.
 */
export async function handleApi(request: Request, deps: ApiDeps): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${API_BASE}/`)) throw notFound("Unknown address.");
    const subPath = url.pathname.slice(API_BASE.length).replace(/\/+$/, "") || "/";

    let allowed = false;
    for (const route of routes) {
      const match = route.pattern.exec(subPath);
      if (!match) continue;
      allowed = true;
      if (route.method !== request.method) continue;

      const auth = deps.getAuth();
      const base = {
        db: deps.db,
        auth,
        request,
        today: todayInDhaka(deps.now?.()),
        params: match.slice(1),
        query: url.searchParams,
        body: request.method === "GET" || request.method === "DELETE" ? {} : await readBody(request),
        adviceClient: deps.adviceClient,
      };

      if (route.public) return await route.handler(base);

      const current = await auth.api.getSession({ headers: request.headers });
      if (!current) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
      await ensureUserDefaults(deps.db, current.user.id);
      return await route.handler({ ...base, userId: current.user.id, email: current.user.email });
    }
    if (allowed) throw new ApiError(405, "METHOD_NOT_ALLOWED", "That method is not supported here.");
    throw notFound("Unknown address.");
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    if (error instanceof AuthConfigError) {
      console.error(`Accounts are not configured: ${error.message}`);
      return errorResponse(new ApiError(503, "NOT_CONFIGURED", "The server is not set up yet."));
    }
    console.error("API request failed", error);
    return errorResponse(new ApiError(500, "SERVER_ERROR", "Something went wrong. Try again."));
  }
}
