import type { Metadata } from "next";
import { Suspense } from "react";
import EntriesContent from "./entries-content";

export const metadata: Metadata = {
  title: "Entries",
};

export default function EntriesPage({ searchParams }: PageProps<"/entries">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Entries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record money going out, coming in, moving between wallets, or changing in value.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading entries</p>}>
        <EntriesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
