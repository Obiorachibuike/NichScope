import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Next.js 16 proxy (formerly middleware). Auth.js decodes the JWT session cookie
 * on the edge and enforces the `authorized` callback from `src/auth.config.ts`.
 * Server components and route handlers still verify the session independently,
 * so this is defence in depth rather than the only check.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    /*
     * Match application pages only. API routes validate the session themselves
     * and must not be intercepted (webhooks, Auth.js handlers, health checks).
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)",
  ],
};
