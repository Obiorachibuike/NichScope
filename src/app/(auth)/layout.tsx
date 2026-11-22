import Link from "next/link";
import { ArrowLeft, ShieldCheck, Sparkles, PlaySquare } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-radial-brand" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
        <div className="relative">
          <Link href="/" aria-label="NicheScope home">
            <Logo />
          </Link>
        </div>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Research niches like an analyst,
            <span className="gradient-text"> not a gambler.</span>
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            A maintained taxonomy, official YouTube data, explainable opportunity
            scoring and an AI advisor that separates evidence from recommendation.
          </p>
          <ul className="space-y-3 text-sm text-muted-strong">
            <li className="flex gap-2.5">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              Evidence-grounded AI research reports
            </li>
            <li className="flex gap-2.5">
              <PlaySquare className="mt-0.5 size-4 shrink-0 text-primary" />
              Official API only — no scraping, no fake statistics
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              Compliance enforced server-side, not by UI toggles
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-muted">
          NicheScope is an independent product and is not endorsed by YouTube.
        </p>
      </aside>

      <div className="flex flex-col">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to site
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <Logo />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
