import { z } from "zod";

/**
 * Centralised environment configuration.
 *
 * Nothing here is read at module scope in a way that can break a production
 * build without credentials — every subsystem checks for the credentials it
 * needs at call time and degrades safely (empty states, disabled features)
 * when they are absent.
 */

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  AUTH_SECRET: z.string().optional(),
  AUTH_TRUST_HOST: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DATABASE_URL: optionalUrl,
  DIRECT_DATABASE_URL: optionalUrl,
  PGLITE_DATA_DIR: z.string().default(".data/pglite"),
  AUTO_MIGRATE: z.string().default("true"),

  YOUTUBE_API_KEY: z.string().optional(),
  YOUTUBE_DAILY_QUOTA: z.coerce.number().int().positive().default(10_000),
  YOUTUBE_DATA_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  AI_PROVIDER: z.enum(["agnes", "openai", "fixture"]).default("agnes"),
  AGNES_API_KEY: z.string().optional(),
  AGNES_API_BASE_URL: z.string().default("https://api.agnes.ai/v1"),
  AGNES_MODEL: z.string().default("agnes-1"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  WORKER_ENABLED: z.string().default("false"),
  WORKER_EMBEDDED: z.string().default("false"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(3),

  YOUTUBE_ANALYTICS_APPROVAL_STATUS: z
    .enum(["not_approved", "pending", "approved"])
    .default("not_approved"),
  LICENSED_DATA_PROVIDER_ENABLED: z.string().default("false"),
  LICENSED_DATA_PROVIDER_NAME: z.string().default("Licensed analytics provider"),
  LICENSED_DATA_PROVIDER_REF: z.string().optional(),

  DEMO_MODE: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  APP_ENV_LABEL: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
  AUTH_LOGIN_MAX_PER_MINUTE: z.coerce.number().int().positive().default(10),
  AI_DAILY_LIMIT_FREE: z.coerce.number().int().positive().default(3),
  AI_DAILY_LIMIT_PRO: z.coerce.number().int().positive().default(50),
  AI_DAILY_LIMIT_TEAM: z.coerce.number().int().positive().default(200),
  AI_DAILY_COST_CAP_USD: z.coerce.number().nonnegative().default(5),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Never throw during build/prerender: fall back to defaults and log.
    console.error(
      "[env] Invalid environment configuration:",
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
    return envSchema.parse({ ...process.env, NODE_ENV: undefined });
  }
  return result.data;
}

export const env: Env = parseEnv();

export function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

/**
 * Demo mode surfaces the clearly-labelled fixture dataset (taxonomy + demo
 * metrics). It is opt-in outside local development. It never claims to be live
 * YouTube data and is always visually marked in the UI and API responses.
 */
export const demoMode: boolean = bool(
  env.DEMO_MODE,
  env.NODE_ENV !== "production",
);

export const isProduction = env.NODE_ENV === "production";

export const youtubeConfigured = Boolean(env.YOUTUBE_API_KEY);

export const googleOAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

export const licensedProviderConfigured = bool(env.LICENSED_DATA_PROVIDER_ENABLED);

export const aiConfigured =
  env.AI_PROVIDER === "fixture"
    ? false
    : env.AI_PROVIDER === "agnes"
      ? Boolean(env.AGNES_API_KEY)
      : Boolean(env.OPENAI_API_KEY);

export const workerEnabled = bool(env.WORKER_ENABLED);
export const workerEmbedded = bool(env.WORKER_EMBEDDED);

export const sentryConfigured = Boolean(env.SENTRY_DSN);

/** True when the connection string targets the embedded PGlite dev engine. */
export const usingEmbeddedDatabase =
  !env.DATABASE_URL || env.DATABASE_URL.startsWith("pglite:");

export function appUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}
