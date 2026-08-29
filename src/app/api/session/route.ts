import { NextResponse } from "next/server";
import { getSessionUid, clearSession } from "@/lib/session";
import { deleteProfile } from "@/lib/db";

export const runtime = "nodejs";

/** Sign out — clears our session and the Swiggy OAuth cookies. */
export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}

/**
 * Right to erasure. GlycoCart stores health-adjacent data, so deleting it has
 * to be a real, self-serve action rather than a support request.
 */
export async function DELETE() {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    await deleteProfile(uid);
  } catch (err) {
    console.error("Profile deletion failed", err);
    return NextResponse.json({ error: "Couldn't delete your data. Please try again." }, { status: 500 });
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
