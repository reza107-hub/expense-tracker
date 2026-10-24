import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/page-transition";
import { ListPageSkeleton } from "@/components/skeleton";
import CategoriesContent from "./categories-content";
import PageHeader from "@/components/page-header";

export const metadata: Metadata = {
  title: "Categories",
};

export default function CategoriesPage() {
  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
        <PageHeader titleKey="nav.categories" descriptionKey="categories.description" />
        <Reveal fallback={<ListPageSkeleton />}>
          <CategoriesContent />
        </Reveal>
      </main>
    </PageTransition>
  );
}
