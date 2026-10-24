import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/page-transition";
import { WalletsSkeleton } from "@/components/skeleton";
import WalletsContent from "./wallets-content";
import PageHeader from "@/components/page-header";

export const metadata: Metadata = {
  title: "Wallets",
};

export default function WalletsPage() {
  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
        <PageHeader titleKey="nav.wallets" descriptionKey="wallets.description" />
        <Reveal fallback={<WalletsSkeleton />}>
          <WalletsContent />
        </Reveal>
      </main>
    </PageTransition>
  );
}
