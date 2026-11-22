import { z } from "zod";
import { eq } from "drizzle-orm";
import { handleApiError, json, rateLimit, requireApiUser } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { users } from "@/lib/db/schema";
import { getUserProfile } from "@/lib/auth/session";
import { auditLog } from "@/lib/services/audit";
import { getAiUsage } from "@/lib/services/ai";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  preferences: z
    .object({
      theme: z.enum(["dark", "light", "system"]).optional(),
      emailDigest: z.boolean().optional(),
      defaultCountry: z.string().trim().max(2).optional(),
      defaultPeriod: z.enum(["7d", "30d", "90d"]).optional(),
    })
    .optional(),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "settings");
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  try {
    const profile = await getUserProfile(auth.user.id);
    const db = await getReadyDb();
    const usage = await getAiUsage(db, auth.user.id, auth.user.plan);
    return json({ data: { ...profile, aiUsage: usage } });
  } catch (error) {
    return handleApiError(error, { route: "v1/settings" });
  }
}

export async function PATCH(request: Request) {
  const limited = rateLimit(request, "settings-update", { max: 30 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          error: {
            message: "Invalid settings",
            code: "validation_error",
            details: parsed.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const db = await getReadyDb();
    const [current] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, auth.user.id))
      .limit(1);

    const merged = {
      ...(current?.preferences ?? {}),
      ...(parsed.data.preferences ?? {}),
    };

    await db
      .update(users)
      .set({
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.preferences ? { preferences: merged } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, auth.user.id));

    await auditLog(db, {
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "user.settings.updated",
      entityType: "user",
      entityId: auth.user.id,
      metadata: { fields: Object.keys(parsed.data) },
    });

    const profile = await getUserProfile(auth.user.id);
    return json({ data: profile });
  } catch (error) {
    return handleApiError(error, { route: "v1/settings:update" });
  }
}
