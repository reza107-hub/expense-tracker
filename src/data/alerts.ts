import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { getAlerts } from "@/lib/alerts/compute";
import { todayInDhaka } from "@/lib/period";

/** The alerts for the signed-in user. Empty while they have alerts turned off. */
export async function getAlertBanners() {
  const { userId } = await requireUser();
  return getAlerts(getDb(), userId, todayInDhaka());
}
