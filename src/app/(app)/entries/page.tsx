import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/page-transition";
import { ListPageSkeleton } from "@/components/skeleton";
import EntriesContent from "./entries-content";
import PageHeader from "@/components/page-header";

export const metadata: Metadata = {
  title: "Entries",
};

export default function EntriesPage({ searchParams }: PageProps<"/entries">) {
  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
        <PageHeader titleKey="nav.entries" descriptionKey="entries.description" />
        <Reveal fallback={<ListPageSkeleton />}>
          <EntriesContent searchParams={searchParams} />
        </Reveal>
      </main>
    </PageTransition>
  );
}
