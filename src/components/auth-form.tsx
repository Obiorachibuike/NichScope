"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({
  mode,
  googleEnabled,
  demoMode,
}: {
  mode: "login" | "register";
  googleEnabled: boolean;
  demoMode: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const payload = (await response.json()) as {
          error?: { message: string; details?: { message: string; path: string }[] };
        };
        if (!response.ok) {
          const detail = payload.error?.details?.[0]?.message;
          throw new Error(detail ?? payload.error?.message ?? "Registration failed");
        }
        toast.success("Account created. Signing you in…");
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        throw new Error(
          "We couldn't sign you in. Check your email and password, then try again.",
        );
      }
      router.push(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account: "admin" | "demo") => {
    setEmail(account === "admin" ? "admin@nichscope.app" : "demo@nichscope.app");
    setPassword("NicheScope123!");
    setError(null);
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "register" && (
              <span className="text-[11px] text-muted">
                10+ chars, upper, lower &amp; number
              </span>
            )}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={mode === "register" ? 10 : 8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 text-xs text-danger"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Please wait…
            </>
          ) : (
            <>
              {mode === "register" ? "Create account" : "Sign in"}
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="relative flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wide text-muted">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => void signIn("google", { callbackUrl: nextPath })}
          >
            <GoogleIcon /> Continue with Google
          </Button>
        </>
      )}

      {mode === "login" && demoMode && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs font-medium text-muted-strong">
            Demo accounts (development only)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fillDemo("demo")}>
              Creator demo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fillDemo("admin")}>
              Admin demo
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Password: NicheScope123! — these accounts are never seeded in production.
          </p>
        </div>
      )}

      <p className="text-center text-xs text-muted">
        {mode === "login" ? (
          <>
            New to NicheScope?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1c.9-2.8 3.5-5 6.6-5Z"
      />
    </svg>
  );
}
