import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import { PageTransition, Reveal } from "@/components/page-transition";
import { HomeSkeleton } from "@/components/skeleton";
import DashboardContent from "./dashboard-content";

export const metadata: Metadata = {
  title: "Home",
};

export default function Home() {
  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
        <PageHeader titleKey="nav.home" descriptionKey="home.description" />
        <Reveal fallback={<HomeSkeleton />}>
          <DashboardContent />
        </Reveal>
      </main>
    </PageTransition>
  );
}
