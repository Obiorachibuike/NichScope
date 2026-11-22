import Link from "next/link";
import { Compass, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Link href="/" aria-label="NicheScope home">
        <Logo />
      </Link>
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-muted">
        <SearchX className="size-6" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page does not exist</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          The niche, report or page you were looking for may have been removed, renamed or
          never existed. Nothing is inferred when data is missing — we show a real empty state.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="secondary">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild>
          <Link href="/niches">
            <Compass className="size-4" /> Explore niches
          </Link>
        </Button>
      </div>
    </div>
  );
}
