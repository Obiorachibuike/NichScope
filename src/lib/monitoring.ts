import { env, sentryConfigured } from "./env";

/**
 * Error monitoring. Sentry is initialised lazily only when SENTRY_DSN is set,
 * so local development and CI never depend on it and builds stay hermetic.
 */

type GlobalSentry = typeof globalThis & {
  __nichscopeSentry?: Promise<typeof import("@sentry/node") | null>;
};

const g = globalThis as GlobalSentry;

async function loadSentry() {
  if (!sentryConfigured) return null;
  if (!g.__nichscopeSentry) {
    g.__nichscopeSentry = (async () => {
      try {
        const Sentry = await import("@sentry/node");
        Sentry.init({
          dsn: env.SENTRY_DSN,
          environment: process.env.NODE_ENV,
          tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        });
        return Sentry;
      } catch (error) {
        console.error("[monitoring] failed to initialise Sentry", error);
        return null;
      }
    })();
  }
  return g.__nichscopeSentry;
}

export async function captureException(
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  console.error("[error]", error, context);
  const Sentry = await loadSentry();
  if (!Sentry) return;
  try {
    Sentry.captureException(error, { extra: context });
  } catch (captureError) {
    console.error("[monitoring] failed to capture exception", captureError);
  }
}

export async function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
): Promise<void> {
  const Sentry = await loadSentry();
  if (!Sentry) return;
  try {
    Sentry.captureMessage(message, level);
  } catch {
    // ignore
  }
}

export function monitoringStatus() {
  return {
    sentryConfigured,
    environment: process.env.NODE_ENV ?? "development",
  };
}
