import type { Metadata } from "next";
import { Suspense } from "react";
import CategoriesContent from "./categories-content";

export const metadata: Metadata = {
  title: "Categories",
};

export default function CategoriesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Groups for your expenses. Archive a category to stop using it. Past entries keep it.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading categories</p>}>
        <CategoriesContent />
      </Suspense>
    </main>
  );
}
