import * as SecureStore from "expo-secure-store";

/** Address of the deployed web app. Set `EXPO_PUBLIC_API_URL` in `.env` before building. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

const TOKEN_KEY = "session-token";
const TIMEOUT_MS = 25_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export async function loadToken(): Promise<string | null> {
  token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  return token;
}

export async function saveToken(next: string | null): Promise<void> {
  token = next;
  if (next) await SecureStore.setItemAsync(TOKEN_KEY, next);
  else await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
}

/** Called when the server says the session is no longer valid, so the app can show sign-in. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type Options = { method?: string; body?: unknown; auth?: boolean };

/**
 * One call to the server. Errors always come back as an `ApiError`:
 * code NETWORK (no connection), NOT_CONFIGURED (no address in the build), or the code
 * the server sent (INVALID_INPUT, LOW_BALANCE, SIGN_IN_LOCKED, ...).
 */
export async function request<T>(path: string, { method = "GET", body, auth = true }: Options = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, "NOT_CONFIGURED", "The server address is not set.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server.");
  } finally {
    clearTimeout(timer);
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // An empty or non-JSON reply is handled below.
  }

  if (response.ok) return data as T;

  const failure = (data as { error?: { code?: string; message?: string; fieldErrors?: Record<string, string> } } | null)?.error;
  if (response.status === 401 && auth && failure?.code === "UNAUTHORIZED") onUnauthorized?.();
  throw new ApiError(
    response.status,
    failure?.code ?? "SERVER_ERROR",
    failure?.message ?? "Something went wrong.",
    failure?.fieldErrors ?? {},
    (failure ?? {}) as Record<string, unknown>,
  );
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T = { ok: true }>(path: string, body?: unknown) => request<T>(path, { method: "POST", body });
export const put = <T = { ok: true }>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body });
export const del = <T = { ok: true }>(path: string) => request<T>(path, { method: "DELETE" });
