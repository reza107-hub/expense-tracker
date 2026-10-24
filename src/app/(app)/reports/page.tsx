import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import { PageTransition, Reveal } from "@/components/page-transition";
import { ReportsSkeleton } from "@/components/skeleton";
import ReportContent from "./report-content";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
        <PageHeader titleKey="nav.reports" descriptionKey="reports.description" />
        <Reveal fallback={<ReportsSkeleton />}>
          <ReportContent searchParams={searchParams} />
        </Reveal>
      </main>
    </PageTransition>
  );
}
