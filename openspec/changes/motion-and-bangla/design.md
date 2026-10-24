## Context

See `proposal.md` for why. Observed in the code today:

- Every page is a Server Component with its content inside a `<Suspense>` whose fallback is plain text ("Loading wallets"). There are no `loading.tsx` files and no skeletons.
- `cacheComponents` is on. Anything that reads cookies must render behind `<Suspense>`, and the root layout has no boundary. Page titles and descriptions currently sit outside `Suspense`.
- There is no shared Button. Button and link classes are repeated in about 20 files. Only a few use `transition-colors`.
- All text is hard-coded English in about 35 component files. Server messages come from `src/lib/**` and the actions, and unit tests assert their English wording.
- Fonts: Geist, Latin subset only. Dates use hard-coded English month names (`src/lib/entries/display.ts`) and two `Intl` calls with English locales.
- `src/test/protected-code.test.ts` requires `await requireUser()` in every exported function under `src/actions/` and `src/data/`.
- The project is dark only. Colours come from theme variables.
- React 19.3 exports `ViewTransition`. Next 16 documents `useLinkStatus`. Both were found in `node_modules`.

## Goals / Non-Goals

**Goals:**
- One place sets the speed of every animation.
- A language choice that works before sign-in, survives sign-out, and costs one small component per screen.
- No new runtime library for animation or translation.
- Prerendering is not made worse: the static page shell keeps rendering at build time.

**Non-Goals:**
- Translating server messages, saved data, tab titles or Gemini advice (follow-ups below).
- Bangla digits, right-to-left layout (Bangla is left to right), or any third language.
- A light theme, a shared Button refactor, or changing any layout beyond what Bangla text needs.
- Exit animations for panels that unmount (only entrances).

## Decisions

### 1. Page transitions with React `ViewTransition`
Wrap each page in a shared `PageTransition` (`<ViewTransition>` with a named class). It goes in each `page.tsx`, not the layout, because Next's guide notes a layout stays mounted across navigations so enter and exit never fire there. The `::view-transition-old/new` durations are set in `globals.css` from CSS variables: `--motion-page: 350ms`, `--motion-click: 120ms` and `--motion-panel: 200ms`. Navigation in Next is a transition, so it animates with no extra code. The effect is a fade plus a small rise, asymmetric as the Next guide advises: old content leaves in about 150 ms and new content arrives over the rest, so the whole change is about 350 ms.

Alternatives: Framer Motion (a new dependency, and it fights Server Components); CSS-only fade-in on mount (does not animate the old page out and replays on every re-render). Rejected.

Trade-off: older browsers skip the animation. That is acceptable because nothing depends on it.

### 2. Loading skeletons reveal through the same mechanism
A `Skeleton` component (a `bg-muted` block with `animate-pulse`) and a small set of page skeletons (cards, list rows, form). Each page's `Suspense` fallback becomes its skeleton, and fallback and content are each wrapped in `ViewTransition` so the swap fades. Skeleton shapes copy each page's real layout so the heading and cards do not jump. A skeleton holds no data.

### 3. Click feedback is one global CSS rule, not per-file edits
As plain CSS outside any `@layer`: `button, a[href], select, summary, [role="button"]` get a transition of colours, transform and opacity over `var(--motion-click)`, and `:active:not(:disabled)` scales to 0.97. It must be unlayered: Tailwind's utility classes (most buttons carry `transition-colors`) sit in a layer and would otherwise override both the 120 ms timing (measured 150 ms in the browser) and the smooth release of the shrink. This reaches all existing buttons without touching 20 files. Disabled and busy buttons do not shrink (the busy ones are already `disabled`). Focus rings are untouched.

Alternative: a shared `<Button>` component. Better long term, but it is a refactor of every form and out of scope here.

### 4. Panel entrance
A `.panel-enter` class (keyframes: opacity 0 to 1, translateY 6px to 0, `--motion-panel: 200ms`) added to the elements that appear on a state toggle in `wallet-actions`, `category-actions`, `entry-rows`, `edit-entry-form`, `loan-controls`, `repayment-rows`, `low-balance-warning`. Entrance only.

### 5. Pending links
`NavLinks` already is a client component. Each item renders a tiny `LinkPending` child that calls `useLinkStatus()` and applies `animate-pulse` while pending. It must be a child of the `Link`, which is how the hook works.

### 6. Reduced motion
One `@media (prefers-reduced-motion: reduce)` block sets the three timing variables to `0ms`, turns off `animate-pulse` and `.panel-enter`, and sets `::view-transition-group(*)` animations to `none`. Content still changes.

### 7. Language: a small typed dictionary and a cookie, no library
- `src/i18n/en.ts` is the source of truth and defines the keys. `src/i18n/bn.ts` must satisfy the same type (`satisfies Record<keyof typeof en, string>`), so a missing key is a type error as well as a test failure. Keys are flat and grouped by prefix (`wallets.add.title`). Strings with values use `{name}` placeholders and a tiny `format()`.
- Cookie `lang` with value `en` or `bn`, path `/`, one year, `sameSite=lax`. A reader validates it and falls back to `en`.
- Server Components call `await getTranslator()`. It reads `cookies()` and returns `t(key, values?)`.
- Client components use `useT()` from a `LanguageProvider` that receives only the chosen language's dictionary as a prop (about 200 short strings, so the browser never downloads both).
- The provider and the server reads live **inside the existing `Suspense`** boundaries. In `(app)/layout.tsx` one `Suspense` wraps `children` with a skeleton fallback, and the auth shell does the same. The static header text of each page (title and description) moves inside that boundary and is translated there.

Alternatives: `next-intl` (adds routing by URL prefix and a dependency, more than needed); Google Translate widget (rejected: it would send amounts, names and notes to Google, which breaks the privacy rule used for Gemini, and it rewrites the DOM under React).

### 8. Setting the language
`setLanguageAction(lang)` validates the value, writes the cookie and calls `revalidatePath("/", "layout")`. It lives in `src/lib/i18n/actions.ts`, next to `signOut` in `src/lib/auth/actions.ts`, **not** in `src/actions/`. It must work before sign-in, so it cannot call `requireUser()`, and the protected-code test would otherwise fail. It touches no user data. The switch calls it in a transition, so the page refreshes in place and keeps the current URL.

### 9. Font and `lang`
Add `Noto_Sans_Bengali` (subset `bengali`) in `src/app/layout.tsx` and append it to the font stack in `globals.css` after Geist. The browser picks glyphs per character, so the root layout does not need to know the language, and it stays free of cookie reads. For `<html lang>`, a tiny client component inside the provider sets `document.documentElement.lang` in an effect. The server-rendered attribute stays `en` and is corrected on hydration. This costs a brief wrong value for screen readers on first paint. The alternative is a root `cookies()` read, which would stop the whole app from prerendering. Accepted.

### 10. Dates and months
`monthName` and `formatDate` take the translator's month list (12 entries in each dictionary) and the advice time uses `Intl.DateTimeFormat` with `bn-BD` and `numberingSystem: "latn"` so digits stay Latin. `formatTaka` is not touched.

### 11. Translation workflow
I write the Bangla and mark each dictionary group for native review. Money words (balance, net position, principal, interest) are listed in the tasks for a native reader to confirm before release. A test asserts both dictionaries have identical keys, no value is empty, and the `{placeholders}` match between languages.

## Risks / Trade-offs

- [Slow page transitions feel laggy] -> One variable (`--motion-page`) to tune; clicks stay fast (120 ms); nothing waits for the animation.
- [Bangla strings are longer and break the 360 px layout] -> A phone-size pass in Bangla on the tabs, the bottom bar and the forms; allow wrapping where `truncate` hides meaning.
- [English server messages beside Bangla labels look inconsistent] -> Stated in the spec and shown to the user as a known limit. Follow-up change: return message keys from validators and translate at the action boundary, keeping the logic and tests intact.
- [Default category names stay English] -> Follow-up: store a key for default categories and translate it on display.
- [Wrong `lang` on first paint] -> See decision 9. Tab titles are English for the same reason.
- [Hidden English left behind] -> Search for string literals in components after translating, and a review checklist of every page in both languages.
- [Wrapping page content in `Suspense` loses static prerender of page headers] -> They are trivial; the content was already fully dynamic.
- [Animation on a low-end phone] -> Only opacity and transform are animated, and reduced motion turns it all off.

## Migration Plan

No data migration. Ship behind no flag: the default stays English and animation is additive. Rollback is redeploying the previous build. The cookie is harmless if the feature is removed.

## Open Questions

None that block implementation. Deferred to follow-up changes: translating server messages, default category names, tab titles and advice language; Bangla digits if the user wants them later.
