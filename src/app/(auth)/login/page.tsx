import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { demoMode, googleOAuthConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to NicheScope to research YouTube niches.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to continue your niche research.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <AuthForm
          mode="login"
          googleEnabled={googleOAuthConfigured}
          demoMode={demoMode}
        />
      </Suspense>
    </div>
  );
}
