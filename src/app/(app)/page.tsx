import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardContent from "./dashboard-content";

export const metadata: Metadata = {
  title: "Home",
};

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">Where your money stands today.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
