import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { getAlertSettings, getMonthStartDay } from "@/lib/settings/queries";

/** The signed-in user's settings. */
export async function getSettings() {
  const { userId } = await requireUser();
  const db = getDb();
  const [monthStartDay, alerts] = await Promise.all([
    getMonthStartDay(db, userId),
    getAlertSettings(db, userId),
  ]);
  return { monthStartDay, ...alerts };
}
