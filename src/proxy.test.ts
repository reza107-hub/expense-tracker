import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

// Every page the app shell links to, plus a few that do not exist yet.
const PRIVATE_PAGES = [
  "/",
  "/entries",
  "/wallets",
  "/loans",
  "/reports",
  "/categories",
  "/settings",
  "/wallets/1",
  "/does-not-exist",
];
const PUBLIC_PAGES = ["/sign-in", "/register"];

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });

const redirectTarget = (response: Response) => {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
};
const passesThrough = (response: Response) =>
  response.headers.get("location") === null && response.headers.get("x-middleware-next") === "1";

describe("proxy (route guard)", () => {
  it.each(PRIVATE_PAGES)("redirects %s to sign-in without a session cookie", (path) => {
    const response = proxy(request(path));
    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe("/sign-in");
  });

  it.each(PRIVATE_PAGES)("lets %s through when a session cookie is present", (path) => {
    expect(passesThrough(proxy(request(path, "better-auth.session_token=abc.def")))).toBe(true);
  });

  it("recognises the secure cookie name used in production", () => {
    const cookie = "__Secure-better-auth.session_token=abc.def";
    expect(passesThrough(proxy(request("/wallets", cookie)))).toBe(true);
  });

  it("ignores unrelated cookies", () => {
    const response = proxy(request("/wallets", "theme=dark; other=1"));
    expect(redirectTarget(response)).toBe("/sign-in");
  });

  it.each(PUBLIC_PAGES)("shows %s to a visitor", (path) => {
    expect(passesThrough(proxy(request(path)))).toBe(true);
  });

  it.each(PUBLIC_PAGES)(
    "never redirects away from %s, even with a cookie, so a stale cookie cannot cause a loop",
    (path) => {
      expect(passesThrough(proxy(request(path, "better-auth.session_token=stale")))).toBe(true);
    },
  );
});

describe("proxy matcher", () => {
  const pattern = new RegExp(`^${config.matcher[0]}$`);

  it("covers app pages and the public pages", () => {
    for (const path of [...PRIVATE_PAGES, ...PUBLIC_PAGES]) {
      expect(pattern.test(path), path).toBe(true);
    }
  });

  it("skips Next.js internals and static images", () => {
    for (const path of ["/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/logo.png", "/next.svg"]) {
      expect(pattern.test(path), path).toBe(false);
    }
  });
});
