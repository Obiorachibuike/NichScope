import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 * The key is derived from AUTH_SECRET, so rotating the secret invalidates
 * stored provider tokens (they are re-obtained on next sign-in).
 */
function key(): Buffer {
  const secret =
    env.AUTH_SECRET ??
    (env.NODE_ENV === "production"
      ? // Refuse to silently use a well-known key in production.
        (() => {
          throw new Error("AUTH_SECRET is required to encrypt provider tokens");
        })()
      : "nichscope-development-secret-do-not-use-in-production");
  return createHash("sha256").update(`nichscope:token:v1:${secret}`).digest();
}

export function encryptToken(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptToken(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/** Constant-time comparison for secrets/tokens. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
