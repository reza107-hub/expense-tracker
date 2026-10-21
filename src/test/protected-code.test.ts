import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guard for authorisation. Server Actions are public HTTP endpoints, and the route
 * guard only redirects page visits, so every action and every data read must check
 * the session itself. This fails the build if a function in these folders forgets.
 *
 *   src/actions/**  Server Actions (files that start with "use server")
 *   src/data/**     Data-layer reads and writes
 *
 * Add `await requireUser()` as the first line of each exported function.
 */
const SRC = fileURLToPath(new URL("..", import.meta.url));
const PROTECTED_DIRS = ["actions", "data"];

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Splits a file into its exported functions and returns each one's name and body. */
function exportedFunctions(code: string): { name: string; body: string }[] {
  const starts = [
    ...code.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/g),
    ...code.matchAll(/export\s+const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/g),
  ].sort((a, b) => a.index - b.index);

  return starts.map((match, i) => ({
    name: match[1],
    body: code.slice(match.index, starts[i + 1]?.index ?? code.length),
  }));
}

describe("protected code requires a session", () => {
  const files = PROTECTED_DIRS.flatMap((dir) => sourceFiles(join(SRC, dir)));

  it("scans the protected folders (none exist yet in early phases)", () => {
    expect(Array.isArray(files)).toBe(true);
  });

  for (const file of files) {
    const code = readFileSync(file, "utf8");
    for (const { name, body } of exportedFunctions(code)) {
      it(`${file.replace(SRC, "src/")}: ${name} calls requireUser`, () => {
        expect(body).toMatch(/await\s+requireUser\(\)/);
      });
    }
  }

  it("recognises an unprotected function (self-check of this guard)", () => {
    const bad = "export async function addExpense() { await db.insert(x); }";
    const good = "export async function addExpense() { await requireUser(); await db.insert(x); }";
    expect(exportedFunctions(bad)[0].body).not.toMatch(/await\s+requireUser\(\)/);
    expect(exportedFunctions(good)[0].body).toMatch(/await\s+requireUser\(\)/);
  });

  it("splits several exports and checks each one separately", () => {
    const code = `
      export async function a() { await requireUser(); }
      export const b = async () => { return 1; };
      export async function c() { await requireUser(); }`;
    const fns = exportedFunctions(code);
    expect(fns.map((f) => f.name)).toEqual(["a", "b", "c"]);
    expect(fns.map((f) => /await\s+requireUser\(\)/.test(f.body))).toEqual([true, false, true]);
  });
});
