"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import { NAV_ITEMS } from "./nav-items";

type NavLinksProps = {
  variant: "sidebar" | "bottom";
};

/**
 * Pulses over its link while the page it points to is still loading. It has to be a
 * child of the Link, which is how useLinkStatus knows which link it belongs to.
 */
function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 animate-pulse rounded-md bg-primary/15"
    />
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function NavLinks({ variant }: NavLinksProps) {
  const pathname = usePathname();
  const t = useT();
  const items =
    variant === "bottom" ? NAV_ITEMS.filter((item) => item.primary) : NAV_ITEMS;

  if (variant === "bottom") {
    return (
      <ul className="grid grid-cols-5">
        {items.map(({ href, labelKey, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 px-1 py-2.5 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(labelKey)}
                <LinkPending />
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(labelKey)}
              <LinkPending />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
