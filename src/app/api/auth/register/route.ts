import { z } from "zod";
import { eq } from "drizzle-orm";
import { apiError, handleApiError, json, rateLimit } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { subscriptions, users } from "@/lib/db/schema";
import { auditLog } from "@/lib/services/audit";
import { clientIp } from "@/lib/services/rate-limit";

export const runtime = "nodejs";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200)
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "register", { windowMs: 300_000, max: 5 });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid registration details", 400, "validation_error", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const db = await getReadyDb();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);
    if (existing[0]) {
      return apiError(
        "An account with that email already exists.",
        409,
        "email_taken",
      );
    }

    const { hash } = await import("bcryptjs");
    const passwordHash = await hash(parsed.data.password, 12);

    const inserted = await db
      .insert(users)
      .values({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        plan: "free",
        role: "user",
        preferences: { theme: "dark", emailDigest: false },
      })
      .returning({ id: users.id, email: users.email, name: users.name });

    const user = inserted[0]!;
    await db.insert(subscriptions).values({
      userId: user.id,
      plan: "free",
      status: "active",
      provider: "manual",
      metadata: { createdVia: "registration" },
    });

    await auditLog(db, {
      action: "auth.register",
      actorId: user.id,
      actorEmail: user.email,
      ip: clientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      metadata: { plan: "free" },
    });

    return json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { route: "auth/register" });
  }
}
