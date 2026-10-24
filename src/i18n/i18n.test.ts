import { describe, expect, it } from "vitest";
import { bn } from "./bn";
import { en } from "./en";
import {
  createTranslator,
  format,
  getDictionary,
  isLanguage,
  parseLanguage,
  placeholdersOf,
} from "./index";

describe("dictionaries", () => {
  const enKeys = Object.keys(en).sort();
  const bnKeys = Object.keys(bn).sort();

  it("English and Bangla have exactly the same keys", () => {
    expect(bnKeys).toEqual(enKeys);
  });

  it("no text is empty", () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(bn)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("each text uses the same {placeholders} in both languages", () => {
    for (const key of enKeys) {
      const english = placeholdersOf(en[key as keyof typeof en]);
      const bangla = placeholdersOf(bn[key as keyof typeof bn]);
      expect(bangla, key).toEqual(english);
    }
  });

  it("has all twelve long and short month names, with no repeats among the long ones", () => {
    for (const dictionary of [en, bn]) {
      const long = Array.from({ length: 12 }, (_, i) => dictionary[`month.${i + 1}` as keyof typeof en]);
      const short = Array.from({ length: 12 }, (_, i) => dictionary[`monthShort.${i + 1}` as keyof typeof en]);
      expect(new Set(long).size).toBe(12);
      expect(short.every(Boolean)).toBe(true);
    }
  });

  it("Bangla text really is in Bangla script", () => {
    expect(bn["nav.wallets"]).toMatch(/[ঀ-৿]/);
    expect(bn["month.10"]).toMatch(/[ঀ-৿]/);
  });
});

describe("parseLanguage", () => {
  it("accepts only en and bn", () => {
    expect(parseLanguage("bn")).toBe("bn");
    expect(parseLanguage("en")).toBe("en");
  });

  it("falls back to English for nothing or anything else", () => {
    for (const value of [undefined, null, "", "BN", "fr", "bn ", "<script>", "bn;en"]) {
      expect(parseLanguage(value as string | undefined)).toBe("en");
    }
  });

  it("isLanguage is strict", () => {
    expect(isLanguage("bn")).toBe(true);
    expect(isLanguage("bangla")).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});

describe("format", () => {
  it("fills named values, including repeats and numbers", () => {
    expect(format("{a} and {a} and {n}", { a: "x", n: 3 })).toBe("x and x and 3");
  });

  it("leaves a marker with no value in place, so a mistake is easy to see", () => {
    expect(format("Hello {name}", {})).toBe("Hello {name}");
    expect(format("Hello {name}")).toBe("Hello {name}");
  });

  it("does not treat a value as a marker", () => {
    expect(format("{a}", { a: "{b}", b: "no" })).toBe("{b}");
  });

  it("returns text without markers unchanged", () => {
    expect(format("Wallets", { a: 1 })).toBe("Wallets");
  });
});

describe("createTranslator", () => {
  it("translates in the chosen language", () => {
    expect(createTranslator(getDictionary("en"))("nav.wallets")).toBe("Wallets");
    expect(createTranslator(getDictionary("bn"))("nav.wallets")).toBe(bn["nav.wallets"]);
  });
});
