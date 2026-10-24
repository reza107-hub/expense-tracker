import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthSkeleton } from "@/components/skeleton";
import LanguageScope from "@/i18n/language-scope";
import { getTranslator } from "@/i18n/server";
import AuthShell from "@/components/auth/auth-shell";
import RedirectIfSignedIn from "@/components/auth/redirect-if-signed-in";
import RegisterForm from "./register-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  // The language comes from a cookie, so the page sits inside this boundary.
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <LanguageScope>
        <RegisterView />
      </LanguageScope>
    </Suspense>
  );
}

async function RegisterView() {
  const { t } = await getTranslator();
  return (
    <AuthShell
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      footer={
        <>
          {t("auth.register.haveAccount")}{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:underline">
            {t("auth.register.signInLink")}
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <RegisterForm />
    </AuthShell>
  );
}
