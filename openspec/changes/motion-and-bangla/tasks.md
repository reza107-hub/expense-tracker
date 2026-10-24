## 1. Motion foundations

- [x] 1.1 Add `--motion-page` (350ms), `--motion-click` (120ms) and `--motion-panel` (200ms) to `globals.css`, a `.panel-enter` keyframe class, and one `prefers-reduced-motion` block that zeroes them and disables pulse and view-transition animation, and verify by reading the CSS that no colour value was added and the reduced-motion block covers all three variables
- [x] 1.2 Add the global click-feedback rule in `@layer base` (unlayered, so Tailwind utility classes cannot override it; colour, transform and opacity transition on buttons, links, selects and summaries; `:active:not(:disabled)` shrink to 0.97; focus ring untouched), and verify with a code search that no component needed an edit and that disabled buttons are excluded
- [x] 1.3 Add the `Skeleton` component and page skeletons (cards, list rows, form block) that copy each page's layout, and verify a unit test renders each without any text or figure from user data

## 2. Page transitions and loading

- [x] 2.1 Wrap each page (a shared `PageTransition`) in `<ViewTransition>`, in the page and not the layout because a layout stays mounted and never fires enter or exit, with the asymmetric page CSS (old leaves in about 150ms, new arrives over the rest, total about 350ms from `--motion-page`), and verify `pnpm build` in a Linux copy still prerenders every route
- [x] 2.2 Replace each page's text `Suspense` fallback (home, wallets, categories, entries, loans, reports, settings, advice section) with its skeleton, with fallback and content each in `ViewTransition`, and verify by search that no "Loading ..." text fallback remains
- [x] 2.3 Add the pending pulse to `NavLinks` with a `LinkPending` child using `useLinkStatus`, and verify it type-checks and is a child of each `Link`
- [x] 2.4 Apply `.panel-enter` to the panels that open in place (wallet, category, entry and loan edit, delete and repay panels, repayment delete, low-balance warning), and verify each panel element has the class by search

## 3. Language core

- [x] 3.1 Create `src/i18n/en.ts` (the key source, including 12 month names and the date and advice-time wording) and `src/i18n/bn.ts` typed to the same keys, with a `format()` for `{placeholder}` values, and verify a unit test that both have identical keys, no empty values, and matching placeholders
- [x] 3.2 Add the `lang` cookie reader (only "en" or "bn", otherwise "en"), `getTranslator()` for Server Components and `LanguageProvider` with `useT()` for client components that receives only the chosen dictionary, and verify unit tests for the cookie fallback and for `format()`
- [x] 3.3 Add `setLanguageAction` in `src/lib/i18n/actions.ts` (outside `src/actions/`, no `requireUser`, because it must work before sign-in and touches no user data) that validates, sets a one-year cookie and revalidates the layout, and verify a unit test that an invalid value is rejected and `protected-code.test.ts` still passes
- [x] 3.4 Add `Noto_Sans_Bengali` in the root layout and append it to the font stack, add the small client component that sets `document.documentElement.lang`, and wrap the `(app)` children and the auth shell in `Suspense` plus `LanguageProvider`, and verify `pnpm build` in a Linux copy passes with no "blocking route" error

## 4. Language switch

- [x] 4.1 Build the `LanguageSwitch` client component ("EN" and "বাং", current one marked with `aria-pressed`, calls the action in a transition so the URL and page stay put), and verify a unit test for the marked state and that it renders text in both languages
- [x] 4.2 Place it in the phone header, at the top of the desktop sidebar and in the auth shell, and verify by reading the three files and, in the browser pass, that it appears on all three

## 5. Translate the screens

- [x] 5.1 Translate the shell: navigation labels, app name area, sign-out, settings link, alert banners and loan alert sentences, and verify no English literal remains in `components/app-shell` by search
- [x] 5.2 Translate sign-in and register (titles, labels, hints, buttons, footer links), and verify no English literal remains in `app/sign-in`, `app/register` and `components/auth` outside server messages
- [x] 5.3 Translate Home and Reports, including the fixed text of the saving-advice section and its button, and verify by search that only data-driven values remain as literals
- [x] 5.4 Translate Wallets and Categories (titles, forms, presets stay as the brand names, hints, buttons, archive and restore text, empty states), and verify by search
- [x] 5.5 Translate Entries (type tabs, forms, filters, month navigation, list rows, low-balance warning, edit and delete text) and make the date formatters use the dictionary month names, and verify `display.test.ts` is updated for both languages and passes
- [x] 5.6 Translate Loans (totals, create form, card, repay, edit and delete panels, repayment rows) and Settings (month start day and alerts forms), and verify by search
- [ ] 5.7 Have a native Bangla reader review the dictionary, with the money terms (balance, net position, principal, interest or fee, outstanding, repaid) listed first, and verify the reviewer's changes are applied and the key-parity test still passes

## 6. Quality

- [x] 6.1 Run lint, typecheck and the whole test suite, and verify all pass
- [x] 6.2 Search the source for emoji, hex or rgb colours and hard-coded Tailwind colour classes added by this change, and verify none are found
- [x] 6.3 Build in a Linux copy, and verify the build passes, and that the Gemini key is still absent from the client output and the dictionary files hold no user data
- [x] 6.4 With permission to use `playwright-cli`, on a throwaway database with two accounts at 360 pixels, verify in English and in Bangla that the page transition plays and is about 350ms, skeletons show and fade into content, buttons shrink on press and not when disabled, panels fade in, the pending pulse shows on a slow link, the switch works on all three places and survives sign-out, no screen scrolls sideways or cuts off text in Bangla, and amounts keep the same digits, then delete the screenshots and `.playwright-cli`
- [x] 6.5 With the browser set to reduced motion, verify no transition, pulse, shrink or panel movement plays and every page still changes correctly
