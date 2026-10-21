/**
 * Environment variables that could point a test at a real service or hold a real
 * secret. The test setup removes them before any test runs.
 */
export const PRODUCTION_ENV =
  /^(DATABASE_URL|POSTGRES_|PG|NEON_|GEMINI_|BETTER_AUTH_|ALLOWED_EMAILS$|VERCEL_URL$|AUTH_SECRET$)/;
