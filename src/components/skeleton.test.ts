import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PageSkeleton,
  Skeleton,
  SkeletonCard,
  SkeletonForm,
  SkeletonList,
} from "./skeleton";

/** The text a user would read: markup with every tag removed. */
const textOf = (html: string) => html.replace(/<[^>]*>/g, "").trim();

describe("skeletons", () => {
  const cases: [string, ReturnType<typeof createElement>][] = [
    ["Skeleton", createElement(Skeleton, { className: "h-4" })],
    ["SkeletonCard", createElement(SkeletonCard)],
    ["SkeletonCard with lines", createElement(SkeletonCard, { lines: 4 })],
    ["SkeletonList", createElement(SkeletonList, { rows: 5 })],
    ["SkeletonForm", createElement(SkeletonForm)],
    ["PageSkeleton", createElement(PageSkeleton)],
  ];

  for (const [name, element] of cases) {
    it(`${name} shows no text, no figure and no data, only pulsing blocks`, () => {
      const html = renderToStaticMarkup(element);
      expect(textOf(html)).toBe("");
      expect(html).not.toContain("৳");
      expect(html).toContain("animate-pulse");
    });
  }

  it("hides the blocks from screen readers and marks the page busy", () => {
    const block = renderToStaticMarkup(createElement(Skeleton));
    expect(block).toContain('aria-hidden="true"');
    const page = renderToStaticMarkup(createElement(PageSkeleton));
    expect(page).toContain('aria-busy="true"');
  });

  it("uses theme colours only", () => {
    const html = renderToStaticMarkup(createElement(PageSkeleton));
    expect(html).toContain("bg-muted");
    expect(html).not.toMatch(/bg-(white|black|gray|slate|zinc|neutral)/);
  });
});
