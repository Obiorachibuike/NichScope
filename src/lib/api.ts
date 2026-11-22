import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { checkRateLimit, clientIp } from "@/lib/services/rate-limit";
import { ComplianceError } from "@/lib/services/compliance";
import { QuotaExceededError } from "@/lib/services/youtube/quota";
import { WatchlistError } from "@/lib/services/watchlist";
import { AILimitError, AIUnavailableError } from "@/lib/services/ai";
import { AIProviderError } from "@/lib/services/ai/providers";
import { YouTubeApiError, YouTubeNotConfiguredError } from "@/lib/services/youtube/client";
import { captureException } from "@/lib/monitoring";

export interface ApiErrorBody {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export function apiError(
  message: string,
  status: number,
  code = "error",
  details?: unknown,
) {
  return NextResponse.json(
    { error: { message, code, details } } satisfies ApiErrorBody,
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function handleApiError(error: unknown, context: Record<string, unknown> = {}) {
  if (error instanceof ZodError) {
    return apiError(
      "Invalid request",
      400,
      "validation_error",
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  if (error instanceof ComplianceError) {
    return apiError(error.message, 403, "compliance_denied");
  }
  if (error instanceof QuotaExceededError) {
    return apiError(error.message, 429, "quota_exceeded", {
      used: error.used,
      limit: error.limit,
    });
  }
  if (error instanceof WatchlistError) {
    return apiError(error.message, error.status, "watchlist_error");
  }
  if (error instanceof AILimitError) {
    return apiError(error.message, 429, "ai_limit_reached");
  }
  if (error instanceof AIUnavailableError) {
    return apiError(error.message, 503, "ai_unavailable");
  }
  if (error instanceof AIProviderError) {
    return apiError(
      "The AI provider could not complete this request. Please retry shortly.",
      502,
      "ai_provider_error",
    );
  }
  if (error instanceof YouTubeNotConfiguredError) {
    return apiError(error.message, 503, "youtube_not_configured");
  }
  if (error instanceof YouTubeApiError) {
    return apiError(
      error.message,
      error.status === 429 ? 429 : 502,
      "youtube_api_error",
    );
  }
  if (
    error instanceof Error &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status;
    return apiError(error.message, status, status === 404 ? "not_found" : "error");
  }

  void captureException(error, context);
  return apiError("An unexpected error occurred.", 500, "internal_error");
}

export async function requireApiUser(): Promise<
  { user: SessionUser; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return { response: apiError("Authentication required", 401, "unauthorized") };
  }
  return { user };
}

export async function requireApiAdmin(): Promise<
  { user: SessionUser; response?: never } | { user?: never; response: NextResponse }
> {
  const result = await requireApiUser();
  if (!result.user) return result;
  if (result.user.role !== "admin") {
    return { response: apiError("Administrator access required", 403, "forbidden") };
  }
  return result;
}

export function rateLimit(
  request: Request,
  scope: string,
  options: { windowMs?: number; max?: number } = {},
): NextResponse | null {
  const ip = clientIp(request.headers);
  const result = checkRateLimit(`${scope}:${ip}`, options);
  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      {
        error: {
          message: "Too many requests. Please slow down.",
          code: "rate_limited",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return null;
}

export function searchParamsFrom(request: Request): Record<string, string> {
  const url = new URL(request.url);
  const output: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    hasNext: page * pageSize < total,
    hasPrevious: page > 1,
  };
}
