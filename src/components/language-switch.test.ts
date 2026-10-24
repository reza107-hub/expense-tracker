import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { bn } from "@/i18n/bn";
import { renderInLanguage } from "@/test/render-in-language";

vi.mock("@/lib/i18n/actions", () => ({ setLanguageAction: vi.fn() }));
const { default: LanguageSwitch } = await import("./language-switch");

const render = (language: "en" | "bn") => renderInLanguage(language, createElement(LanguageSwitch));

/** The opening tag of the button that shows this label. */
const buttonFor = (html: string, label: string) =>
  [...html.matchAll(/<button[^>]*>[^<]*<\/button>/g)]
    .map((m) => m[0])
    .find((tag) => tag.endsWith(`>${label}</button>`));

describe("LanguageSwitch", () => {
  it("offers EN and বাং and marks English as the current language", () => {
    const html = render("en");
    expect(buttonFor(html, "EN")).toContain('aria-pressed="true"');
    expect(buttonFor(html, "বাং")).toContain('aria-pressed="false"');
  });

  it("marks Bangla as current when Bangla is chosen", () => {
    const html = render("bn");
    expect(buttonFor(html, "বাং")).toContain('aria-pressed="true"');
    expect(buttonFor(html, "EN")).toContain('aria-pressed="false"');
  });

  it("labels the group in the current language", () => {
    expect(render("en")).toContain('aria-label="Language"');
    expect(render("bn")).toContain(`aria-label="${bn["language.label"]}"`);
  });

  it("tags each button with its own language so screen readers say it correctly", () => {
    const html = render("en");
    expect(buttonFor(html, "EN")).toContain('lang="en"');
    expect(buttonFor(html, "বাং")).toContain('lang="bn"');
  });

  it("uses theme colours only", () => {
    expect(render("en")).not.toMatch(/(bg|text|border)-(white|black|gray|slate|zinc)/);
  });
});
