import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";

function key(secret: string | undefined): Buffer {
  if (!secret) throw new AppError("internal", "ENCRYPTION_KEY is not configured.");
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM. Output is base64url(iv).base64url(tag).base64url(ciphertext). */
export function encrypt(plain: string, secret: string | undefined): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string, secret: string | undefined): string {
  const [iv, tag, body] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !body) throw new AppError("internal", "Corrupted encrypted payload.");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    throw new AppError("internal", "Could not decrypt payload. Was ENCRYPTION_KEY changed?");
  }
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Stable, opaque host identifier for this installation (UUID-shaped, derived from the secret). */
export function deriveHostId(secret: string | undefined): string {
  const bytes = createHmac("sha256", key(secret)).update("github-graveyard:ext_agent_host_id").digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
