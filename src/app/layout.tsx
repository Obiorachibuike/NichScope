import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { appUrl } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: "NicheScope — Discover Winning YouTube Niches",
    template: "%s · NicheScope",
  },
  description:
    "Discover growing YouTube niches, research successful channels and uncover content opportunities with intelligent analytics.",
  applicationName: "NicheScope",
  keywords: [
    "YouTube niche finder",
    "YouTube analytics",
    "niche research",
    "channel research",
    "creator tools",
  ],
  openGraph: {
    title: "NicheScope — Find Your Next Winning YouTube Niche",
    description:
      "Discover growing YouTube niches, research successful channels and uncover content opportunities with intelligent analytics.",
    type: "website",
    siteName: "NicheScope",
  },
  twitter: {
    card: "summary_large_image",
    title: "NicheScope — Find Your Next Winning YouTube Niche",
    description:
      "YouTube niche discovery and intelligence for creators and marketers.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090D12" },
    { media: "(prefers-color-scheme: light)", color: "#F5F8FB" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
