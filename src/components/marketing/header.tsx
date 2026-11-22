"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#analytics", label: "Analytics" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="NicheScope home">
          <Logo />
        </Link>
        <nav className="ml-8 hidden items-center gap-6 md:flex" aria-label="Main">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-strong transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {signedIn ? (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-strong md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-surface px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-strong hover:bg-card hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="flex-1">
                <Link href={signedIn ? "/dashboard" : "/register"}>
                  {signedIn ? "Dashboard" : "Get started"}
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              NicheScope helps creators and marketers discover YouTube niches
              with defensible data, transparent sources and honest estimates.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Product</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-strong">
              <li><Link href="/niches" className="hover:text-foreground">Niche Explorer</Link></li>
              <li><Link href="/trends" className="hover:text-foreground">Global Trends</Link></li>
              <li><Link href="/advisor" className="hover:text-foreground">AI Advisor</Link></li>
              <li><Link href="/billing" className="hover:text-foreground">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Account</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-strong">
              <li><Link href="/login" className="hover:text-foreground">Sign in</Link></li>
              <li><Link href="/register" className="hover:text-foreground">Create account</Link></li>
              <li><Link href="/settings" className="hover:text-foreground">Settings</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Policies</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-strong">
              <li>
                <a
                  href="https://developers.google.com/youtube/terms/developer-policies"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-foreground"
                >
                  YouTube API policies
                </a>
              </li>
              <li>
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-foreground"
                >
                  YouTube Terms of Service
                </a>
              </li>
              <li><Link href="/settings" className="hover:text-foreground">Data controls</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} NicheScope. All rights reserved.</p>
          <p className="max-w-xl sm:text-right">
            NicheScope uses the official YouTube Data API only where configured, never
            scrapes YouTube, and labels every estimate and demo fixture. YouTube is a
            trademark of Google LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}
