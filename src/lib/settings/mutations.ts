import { settings } from "@/db/schema";
import type { AnyDb } from "@/db/types";

/**
 * Sets the day this user's reporting months start on (1 to 28). Only the settings row
 * changes. No entry is touched: months are worked out from the day when a report runs.
 * The row is created if a repair has not made it yet.
 */
export async function updateMonthStartDay(
  db: AnyDb,
  userId: string,
  monthStartDay: number,
): Promise<void> {
  await db
    .insert(settings)
    .values({ userId, monthStartDay })
    .onConflictDoUpdate({
      target: settings.userId,
      set: { monthStartDay, updatedAt: new Date() },
    });
}

/**
 * Saves this user's alert switch and monthly limit. Only their own settings row
 * changes, so another user's alerts are never affected.
 */
export async function updateAlertSettings(
  db: AnyDb,
  userId: string,
  { alertsEnabled, monthlyLimit }: { alertsEnabled: boolean; monthlyLimit: number | null },
): Promise<void> {
  await db
    .insert(settings)
    .values({ userId, alertsEnabled, monthlyLimit })
    .onConflictDoUpdate({
      target: settings.userId,
      set: { alertsEnabled, monthlyLimit, updatedAt: new Date() },
    });
}
