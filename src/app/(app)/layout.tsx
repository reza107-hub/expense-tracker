import Link from "next/link";
import { Suspense } from "react";
import { LogOut, Settings, Wallet } from "lucide-react";
import AlertBanners from "@/components/app-shell/alert-banners";
import NavLinks from "@/components/app-shell/nav-links";
import { signOut } from "@/lib/auth/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-card p-4 md:flex">
        <div className="flex items-center gap-2 px-2 pt-1 text-card-foreground">
          <Wallet className="size-5 text-primary" aria-hidden="true" />
          <span className="text-base font-semibold tracking-tight">
            Expense Tracker
          </span>
        </div>
        <nav aria-label="Main">
          <NavLinks variant="sidebar" />
        </nav>
        <form action={signOut} className="mt-auto">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-primary" aria-hidden="true" />
            <span className="text-base font-semibold tracking-tight">
              Expense Tracker
            </span>
          </div>
          <div className="flex items-center">
            <Link
              href="/settings"
              aria-label="Settings"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="size-5" aria-hidden="true" />
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </header>

        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          {/* Reads the session, so it sits behind Suspense and never blocks the page. */}
          <Suspense fallback={null}>
            <AlertBanners />
          </Suspense>
          {children}
        </div>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <NavLinks variant="bottom" />
      </nav>
    </div>
  );
}
