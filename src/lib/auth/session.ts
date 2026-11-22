import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./index";
import { getDb } from "@/lib/db/client";
import { subscriptions, users } from "@/lib/db/schema";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  plan: "free" | "pro" | "team";
  status: "active" | "suspended" | "deleted";
  image?: string | null;
}

/** Reads the session without redirecting. Use inside route handlers. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.status !== "active") return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    role: session.user.role,
    plan: session.user.plan,
    status: session.user.status,
    image: session.user.image,
  };
}

/** Server-component guard: redirects unauthenticated users to /login. */
export async function requireUser(nextPath = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** Admin guard: redirects non-admins away from admin surfaces. */
export async function requireAdmin(nextPath = "/admin"): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (user.role !== "admin") redirect("/dashboard?error=forbidden");
  return user;
}

export async function getUserProfile(userId: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      plan: users.plan,
      status: users.status,
      preferences: users.preferences,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return { user: row ?? null, subscription: subscription ?? null };
}
