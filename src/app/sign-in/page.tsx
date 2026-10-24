import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthSkeleton } from "@/components/skeleton";
import LanguageScope from "@/i18n/language-scope";
import { getTranslator } from "@/i18n/server";
import AuthShell from "@/components/auth/auth-shell";
import RedirectIfSignedIn from "@/components/auth/redirect-if-signed-in";
import SignInForm from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  // The language comes from a cookie, so the page sits inside this boundary.
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <LanguageScope>
        <SignInView />
      </LanguageScope>
    </Suspense>
  );
}

async function SignInView() {
  const { t } = await getTranslator();
  return (
    <AuthShell
      title={t("auth.signIn.title")}
      subtitle={t("auth.signIn.subtitle")}
      footer={
        <>
          {t("auth.signIn.newHere")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("auth.signIn.createAccountLink")}
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <SignInForm />
    </AuthShell>
  );
}
