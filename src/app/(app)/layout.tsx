import { count, eq } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { aiReports, nicheWatchlists } from "@/lib/db/schema";
import { demoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await getReadyDb();

  const [[saved], [reports]] = await Promise.all([
    db
      .select({ value: count() })
      .from(nicheWatchlists)
      .where(eq(nicheWatchlists.userId, user.id)),
    db.select({ value: count() }).from(aiReports).where(eq(aiReports.userId, user.id)),
  ]);

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
      }}
      counts={{
        saved: Number(saved?.value ?? 0),
        reports: Number(reports?.value ?? 0),
      }}
      demoData={demoMode}
    >
      {children}
    </AppShell>
  );
}
