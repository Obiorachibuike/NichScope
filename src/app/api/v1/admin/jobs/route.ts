import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiAdmin,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getJobsOverview } from "@/lib/services/admin";
import { enqueueJob } from "@/lib/jobs/queue";
import { isJobName, JOB_NAMES } from "@/lib/jobs/types";
import { auditLog } from "@/lib/services/audit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-jobs");
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const db = await getReadyDb();
    const overview = await getJobsOverview(db);
    return json({
      data: overview,
      meta: { availableJobs: JOB_NAMES },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/jobs" });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "admin-jobs-enqueue", { max: 20 });
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid job request", 400, "validation_error", parsed.error.issues);
    }
    if (!isJobName(parsed.data.name)) {
      return apiError(
        `Unknown job. Available: ${JOB_NAMES.join(", ")}`,
        400,
        "unknown_job",
      );
    }
    const db = await getReadyDb();
    const { job, deduplicated } = await enqueueJob(db, parsed.data.name, parsed.data.payload);
    await auditLog(db, {
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "admin.job.enqueued",
      entityType: "background_job",
      entityId: job.id,
      metadata: { name: parsed.data.name, deduplicated },
    });
    return json({ data: job, meta: { deduplicated } }, { status: 202 });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/jobs:enqueue" });
  }
}
