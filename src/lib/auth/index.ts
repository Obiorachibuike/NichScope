import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import {
  accounts,
  users,
  verificationTokens,
} from "@/lib/db/schema";
import { encryptToken } from "@/lib/crypto";
import { env, googleOAuthConfigured, isProduction } from "@/lib/env";
import { checkRateLimit, clientIp } from "@/lib/services/rate-limit";
import { auditLog } from "@/lib/services/audit";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});

/**
 * Lazily-constructed adapter: the database handle is async (it may be the
 * embedded engine), while Auth.js expects the adapter synchronously. Every
 * method awaits the same memoised connection.
 */
function createAdapter(): Adapter {
  const build = async () =>
    DrizzleAdapter(await getDb(), {
      usersTable: users,
      accountsTable: accounts,
      verificationTokensTable: verificationTokens,
    });

  const base = async () => build();

  return {
    createUser: async (user) => (await base()).createUser!(user),
    getUser: async (id) => (await base()).getUser!(id),
    getUserByEmail: async (email) => (await base()).getUserByEmail!(email),
    async getUserByAccount(providerAccountId) {
      return (await base()).getUserByAccount!(providerAccountId);
    },
    updateUser: async (user) => (await base()).updateUser!(user),
    async deleteUser(userId) {
      await (await base()).deleteUser?.(userId);
    },
    async linkAccount(account) {
      // OAuth tokens are encrypted at rest with AES-256-GCM.
      const encrypted: AdapterAccount = {
        ...account,
        access_token: encryptToken(account.access_token) ?? undefined,
        refresh_token: encryptToken(account.refresh_token) ?? undefined,
        id_token: encryptToken(account.id_token) ?? undefined,
      };
      await (await base()).linkAccount!(encrypted);
    },
    async unlinkAccount(providerAccountId) {
      await (await base()).unlinkAccount?.(providerAccountId);
    },
    createSession: async (session) => (await base()).createSession!(session),
    async getSessionAndUser(sessionToken) {
      return (await base()).getSessionAndUser!(sessionToken);
    },
    updateSession: async (session) => (await base()).updateSession!(session),
    deleteSession: async (sessionToken) => {
      await (await base()).deleteSession?.(sessionToken);
    },
    async createVerificationToken(token) {
      return (await base()).createVerificationToken!(token);
    },
    async useVerificationToken(params) {
      return (await base()).useVerificationToken!(params) ?? null;
    },
  };
}

const devSecret = "nichscope-development-secret-change-me-please";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAdapter(),
  secret: env.AUTH_SECRET ?? (isProduction ? undefined : devSecret),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const ip = request instanceof Request ? clientIp(request.headers) : "unknown";
        const limit = checkRateLimit(`login:${ip}`, {
          windowMs: 60_000,
          max: env.AUTH_LOGIN_MAX_PER_MINUTE,
        });
        if (!limit.allowed) {
          console.warn("[auth] login rate limit hit", ip);
          return null;
        }

        const email = parsed.data.email.toLowerCase();
        const db = await getDb();
        const rows = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        const user = rows[0];
        if (!user?.passwordHash) return null;
        if (user.status !== "active") return null;

        const { compare } = await import("bcryptjs");
        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) {
          await auditLog(db, {
            action: "auth.login.failed",
            actorEmail: email,
            ip,
            metadata: { reason: "invalid_password" },
          });
          return null;
        }

        await db
          .update(users)
          .set({ lastLoginAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, user.id));
        await auditLog(db, {
          action: "auth.login",
          actorId: user.id,
          actorEmail: user.email,
          ip,
          metadata: { method: "credentials" },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          plan: user.plan,
          status: user.status,
        };
      },
    }),
    ...(googleOAuthConfigured
      ? [
          Google({
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role ?? "user";
        token.plan = user.plan ?? "free";
        token.status = user.status ?? "active";
        token.name = user.name ?? token.name;
        token.picture = user.image ?? token.picture;
      }
      // Re-check suspension/plan changes on explicit session updates.
      if (trigger === "update" && token.userId) {
        const db = await getDb();
        const rows = await db
          .select({ role: users.role, plan: users.plan, status: users.status, name: users.name })
          .from(users)
          .where(eq(users.id, token.userId as string))
          .limit(1);
        if (rows[0]) {
          token.role = rows[0].role;
          token.plan = rows[0].plan;
          token.status = rows[0].status;
          token.name = rows[0].name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) ?? token.sub ?? "";
        session.user.role = (token.role as "user" | "admin") ?? "user";
        session.user.plan = (token.plan as "free" | "pro" | "team") ?? "free";
        session.user.status = (token.status as "active" | "suspended" | "deleted") ?? "active";
      }
      return session;
    },
    async signIn({ user, account }) {
      if (!user?.id) return true;
      if (account?.provider === "google" && user.email) {
        const db = await getDb();
        await auditLog(db, {
          actorId: user.id,
          actorEmail: user.email,
          action: "auth.login",
          metadata: { method: "google" },
        });
      }
      return true;
    },
  },
});
