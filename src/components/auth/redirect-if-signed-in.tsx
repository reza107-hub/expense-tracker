import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";

/**
 * Sends a user who is already signed in to the dashboard. The route guard cannot do
 * this, because it only sees that a cookie exists, and a stale cookie would loop.
 * Render it inside <Suspense>, since it reads the request.
 */
export default async function RedirectIfSignedIn() {
  if (await currentUserId()) redirect("/");
  return null;
}
