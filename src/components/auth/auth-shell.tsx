import { Wallet } from "lucide-react";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

/** The centred card used by the sign-in and registration pages. */
export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-card-foreground">
        <div className="flex items-center gap-2">
          <Wallet className="size-5 text-primary" aria-hidden="true" />
          <span className="text-base font-semibold tracking-tight">Expense Tracker</span>
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {children}
        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </main>
  );
}
