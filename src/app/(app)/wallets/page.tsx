import type { Metadata } from "next";
import { Suspense } from "react";
import WalletsContent from "./wallets-content";

export const metadata: Metadata = {
  title: "Wallets",
};

export default function WalletsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Wallets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where your money sits. Balances are worked out from your entries.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading wallets</p>}>
        <WalletsContent />
      </Suspense>
    </main>
  );
}
