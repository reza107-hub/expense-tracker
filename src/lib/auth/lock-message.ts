/** Minutes to show for a lock, rounded up and never below one. */
export function minutesFor(retryAfterSeconds: number): number {
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}
