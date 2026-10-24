## Why

Pages change instantly and show plain "Loading" text, and buttons give no feedback when pressed, so the app feels abrupt and it is unclear whether a click worked. The app is English only, but its users are in Bangladesh and many will find Bangla easier. A first-time reader of the app should be able to use every screen in Bangla.

## What Changes

- Smooth, slightly slowed transitions when the user moves between pages (about 350 ms), and a short press and colour animation on every button, link and drop-down (about 120 ms).
- Pulsing skeleton placeholders instead of "Loading" text, fading into the real content when it arrives.
- A gentle fade-in for panels that open in place (edit, delete confirm, repay).
- A pending pulse on a navigation link while its page loads.
- All motion is switched off for users who ask their device to reduce motion.
- A language switch ("EN" and "বাং") in the phone header, the desktop sidebar and the sign-in and register pages. The choice is remembered on the device.
- Every fixed piece of screen text, the month names and the navigation are shown in Bangla when Bangla is chosen. Numbers stay as 12,345. Bangla needs a font that can draw it, so one is added.
- Not changed in this version: text that comes back from the server (form error messages), saved data such as default category names, tab titles, and the language of Gemini advice. These stay in English and are listed as follow-ups in the design.

## Capabilities

### New Capabilities

- `interface-motion`: page transitions, loading skeletons, click feedback, panel entrance, and respect for reduced motion.
- `interface-language`: English and Bangla display, the language switch, how the choice is remembered, and what is and is not translated.

### Modified Capabilities

None. No existing requirement changes. The earlier `expense-tracker` change has not been archived, so there are no main specs yet. Its "Dark, responsive display" requirement still holds and both new capabilities must keep it true at 360 pixels.

## Impact

- **Code:** `src/app/globals.css` (motion variables and global click rules), `src/app/layout.tsx` (font), `src/app/(app)/layout.tsx` and the auth shell (switch, language scope), every page and component that shows text (about 35 files), and the `Suspense` fallbacks on each page.
- **New code:** a small dictionary module with English and Bangla text, a language cookie, a server action to set it, a skeleton component and the switch component.
- **Dependencies:** one Bangla font from `next/font/google`. No translation library and no animation library. Page transitions use React's built-in `ViewTransition`.
- **Data and privacy:** no database change. The language cookie holds only "en" or "bn". Nothing new is sent to any outside service.
- **Compatibility:** page transitions need a recent Chromium, Safari or Firefox. Where they are missing the app works the same, without the animation.
- **Related work:** the `expense-tracker` deploy (task 11.4) is not blocked by this change. Both can be released separately.
