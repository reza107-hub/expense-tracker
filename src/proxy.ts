import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const SIGN_IN_PATH = "/sign-in";
/** Pages a visitor without a session may open. */
const PUBLIC_PATHS = new Set([SIGN_IN_PATH, "/register"]);

/**
 * Sends visitors who have no session cookie to the sign-in page. This is a convenience
 * for page visits only. It is not the security boundary: it cannot tell whether a cookie
 * is still valid, and Server Actions are not stopped by it. Every Server Action and data
 * read checks the session itself (see requireUser).
 *
 * It never redirects away from the public pages. A stale cookie would otherwise bounce
 * between sign-in and the dashboard forever. Those pages check the real session instead.
 */
export function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
}

export const config = {
  // Everything except Next.js internals and static image files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
