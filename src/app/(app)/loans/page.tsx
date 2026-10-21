import type { Metadata } from "next";
import { Suspense } from "react";
import LoansContent from "./loans-content";

export const metadata: Metadata = {
  title: "Loans",
};

export default function LoansPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Loans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Money you borrowed or lent. Loans never count as income or spending, only the interest
          and fees do.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading loans</p>}>
        <LoansContent />
      </Suspense>
    </main>
  );
}
