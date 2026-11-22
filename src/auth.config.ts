import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration.
 *
 * This file is imported by `src/proxy.ts` (running on the edge runtime), so it
 * must not import the database client, bcrypt or any Node-only module. The
 * credentials and Google providers are attached in `src/lib/auth/index.ts`,
 * which only runs in Node route handlers.
 */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/niches",
  "/subniches",
  "/channels",
  "/videos",
  "/trends",
  "/advisor",
  "/saved",
  "/settings",
  "/billing",
  "/search",
  "/admin",
] as const;

const AUTH_PAGES = ["/login", "/register"] as const;

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", error: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const isProtected = PROTECTED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      );

      if (isProtected) return isLoggedIn;
      if (isLoggedIn && (AUTH_PAGES as readonly string[]).includes(pathname)) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
