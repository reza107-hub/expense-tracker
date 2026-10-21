import { eq } from "drizzle-orm";
import { settings } from "@/db/schema";
import type { AnyDb } from "@/db/types";

/** The day each reporting month starts on, 1 to 28. Defaults to 1 for a new account. */
export async function getMonthStartDay(db: AnyDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ monthStartDay: settings.monthStartDay })
    .from(settings)
    .where(eq(settings.userId, userId));
  return row?.monthStartDay ?? 1;
}

export type AlertSettings = {
  alertsEnabled: boolean;
  /** The monthly spending limit in poisha, or null when none is set. */
  monthlyLimit: number | null;
};

/** This user's alert switch and monthly limit. Alerts are off for a new account. */
export async function getAlertSettings(db: AnyDb, userId: string): Promise<AlertSettings> {
  const [row] = await db
    .select({ alertsEnabled: settings.alertsEnabled, monthlyLimit: settings.monthlyLimit })
    .from(settings)
    .where(eq(settings.userId, userId));
  return row ?? { alertsEnabled: false, monthlyLimit: null };
}
