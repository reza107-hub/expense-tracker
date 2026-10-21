import type { Metadata } from "next";
import { Suspense } from "react";
import ReportContent from "./report-content";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What you spent and where. Only expenses count, not income, transfers or loan principal.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading report</p>}>
        <ReportContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
