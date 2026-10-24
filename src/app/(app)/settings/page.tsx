import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/page-transition";
import { SettingsSkeleton } from "@/components/skeleton";
import SettingsContent from "./settings-content";
import PageHeader from "@/components/page-header";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
        <PageHeader titleKey="nav.settings" descriptionKey="settings.description" />
        <Reveal fallback={<SettingsSkeleton />}>
          <SettingsContent />
        </Reveal>
      </main>
    </PageTransition>
  );
}
