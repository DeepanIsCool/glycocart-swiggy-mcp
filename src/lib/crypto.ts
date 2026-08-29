import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * AES-256-GCM helpers for anything we hand to the browser in a cookie.
 * Shared by the Swiggy OAuth session and the user session so there is one
 * implementation to audit rather than two that can drift apart.
 */

function getKey(): Buffer {
  const secret = process.env.SWIGGY_TOKEN_SECRET;
  if (!secret) throw new Error("SWIGGY_TOKEN_SECRET is not set");
  return createHash("sha256").update(secret).digest();
}

export function encrypt(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decrypt<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    const buf = Buffer.from(raw, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return undefined;
  }
}

/**
 * Pseudonymous, stable user id derived from the user's Swiggy phone number.
 * Salted with the server secret and one-way hashed — we get a durable key
 * without ever storing a phone number, so the profile row holds no direct PII.
 */
export function deriveUid(phoneNumber: string): string {
  const secret = process.env.SWIGGY_TOKEN_SECRET;
  if (!secret) throw new Error("SWIGGY_TOKEN_SECRET is not set");
  return createHash("sha256").update(`${phoneNumber}:${secret}`).digest("hex").slice(0, 32);
}

export const secureCookie = process.env.NODE_ENV === "production";
