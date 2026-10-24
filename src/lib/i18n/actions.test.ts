import { beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { setLanguageAction } = await import("./actions");

describe("setLanguageAction", () => {
  beforeEach(() => set.mockClear());

  it("saves en or bn for a year, for the whole site", async () => {
    await setLanguageAction("bn");
    expect(set).toHaveBeenCalledWith(
      "lang",
      "bn",
      expect.objectContaining({ path: "/", maxAge: 31_536_000, sameSite: "lax", httpOnly: true }),
    );
  });

  it("ignores anything else and writes nothing", async () => {
    for (const value of ["fr", "", "BN", "bn;x=1", "<script>"]) await setLanguageAction(value);
    expect(set).not.toHaveBeenCalled();
  });
});
