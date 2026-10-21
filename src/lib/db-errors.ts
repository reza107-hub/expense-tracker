/** True for a Postgres unique violation, however the driver wraps it. */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current && typeof current === "object"; ) {
    const { code, cause } = current as { code?: string; cause?: unknown };
    if (code === "23505") return true;
    current = cause;
  }
  return false;
}
