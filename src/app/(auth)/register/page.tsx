import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { demoMode, googleOAuthConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a NicheScope account and start discovering niches.",
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Free to start. No credit card required.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AuthForm
          mode="register"
          googleEnabled={googleOAuthConfigured}
          demoMode={demoMode}
        />
      </Suspense>
      <p className="text-[11px] leading-relaxed text-muted">
        By creating an account you agree to use NicheScope's research data responsibly
        and to comply with the YouTube API Services Terms when researching channels.
      </p>
    </div>
  );
}
