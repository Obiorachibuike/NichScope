/**
 * Server boot hook: initialises the database (migrations + taxonomy seed) and
 * starts the embedded job runner when WORKER_EMBEDDED=true. The dedicated
 * worker process is used in production (see docs/DEPLOYMENT.md).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  try {
    const { ensureBootstrapped } = await import("@/lib/db/bootstrap");
    await ensureBootstrapped();
  } catch (error) {
    console.error("[boot] database bootstrap failed", error);
  }

  try {
    const { startEmbeddedRunner } = await import("@/lib/jobs/embedded");
    startEmbeddedRunner();
  } catch (error) {
    console.error("[boot] failed to start embedded job runner", error);
  }
}
