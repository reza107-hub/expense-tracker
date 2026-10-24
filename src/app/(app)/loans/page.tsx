import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/page-transition";
import { ListPageSkeleton } from "@/components/skeleton";
import LoansContent from "./loans-content";
import PageHeader from "@/components/page-header";

export const metadata: Metadata = {
  title: "Loans",
};

export default function LoansPage() {
  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
        <PageHeader titleKey="nav.loans" descriptionKey="loans.description" />
        <Reveal fallback={<ListPageSkeleton withTotals />}>
          <LoansContent />
        </Reveal>
      </main>
    </PageTransition>
  );
}
