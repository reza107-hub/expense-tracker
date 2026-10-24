import { Suspense, ViewTransition, type ReactNode } from "react";

/**
 * Wraps a whole page so moving to or from it fades and rises (see `.page` in
 * globals.css). It has to sit in each page, not in a layout: a layout stays mounted
 * across navigations, so its enter and exit would never play. `default="none"` keeps
 * unrelated updates, such as a form saving, from animating.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}

/**
 * A Suspense boundary whose placeholder fades into the real content when it is ready,
 * instead of popping in (see `.reveal` in globals.css).
 */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="reveal" default="none">
          {fallback}
        </ViewTransition>
      }
    >
      <ViewTransition enter="reveal" default="none">
        {children}
      </ViewTransition>
    </Suspense>
  );
}
