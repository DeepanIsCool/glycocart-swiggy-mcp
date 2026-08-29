import { cookies } from "next/headers";
import { encrypt, decrypt, secureCookie } from "./crypto";

/**
 * The app's own session: a pseudonymous user id, separate from (but only ever
 * issued alongside) a valid Swiggy OAuth session.
 */

const UID_COOKIE = "gc_uid";

export async function getSessionUid(): Promise<string | null> {
  const jar = await cookies();
  return decrypt<string>(jar.get(UID_COOKIE)?.value) ?? null;
}

export async function setSessionUid(uid: string): Promise<void> {
  const jar = await cookies();
  jar.set(UID_COOKIE, encrypt(uid), {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  for (const name of [UID_COOKIE, "swiggy_session", "swiggy_oauth"]) jar.delete(name);
}
