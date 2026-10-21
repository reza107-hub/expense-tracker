import { PRODUCTION_ENV } from "./production-env";

/**
 * Runs before every test file. Keeps tests hermetic: no production credentials in
 * the environment and no real network calls.
 */

// Remove anything that could point a test at real services, even if the shell
// that launched the tests had these exported.
for (const key of Object.keys(process.env)) {
  if (PRODUCTION_ENV.test(key)) delete process.env[key];
}

// Block real network access. A test that needs `fetch` must stub it explicitly.
globalThis.fetch = () => {
  throw new Error("Network access is blocked in tests. Stub fetch in the test.");
};
