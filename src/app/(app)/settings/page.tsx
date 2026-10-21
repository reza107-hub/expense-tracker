import type { Metadata } from "next";
import { Suspense } from "react";
import SettingsContent from "./settings-content";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">How your months and reports work.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings</p>}>
        <SettingsContent />
      </Suspense>
    </main>
  );
}
