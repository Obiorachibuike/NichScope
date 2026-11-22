"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] route error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-danger/30 bg-danger/[0.08] text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          The page failed to render. The error was reported to the server log
          {error.digest ? ` (digest ${error.digest})` : ""}. Retry, or return to the dashboard.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()} variant="secondary">
          <RefreshCw className="size-4" /> Try again
        </Button>
        <Button asChild>
          <a href="/dashboard">Dashboard</a>
        </Button>
      </div>
    </div>
  );
}
