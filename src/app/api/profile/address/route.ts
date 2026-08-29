import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUid } from "@/lib/session";
import { getProfile, saveProfile } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  defaultAddressId: z.string().trim().min(1).max(120),
  defaultAddressLabel: z.string().trim().max(200).optional()
});

/** Change the default delivery address without re-running onboarding. */
export async function PATCH(req: Request) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid address." }, { status: 400 });

  const profile = await getProfile(uid);
  if (!profile) return NextResponse.json({ error: "No profile yet." }, { status: 404 });

  const updated = {
    ...profile,
    defaultAddressId: parsed.data.defaultAddressId,
    defaultAddressLabel: parsed.data.defaultAddressLabel,
    answers: {
      ...profile.answers,
      defaultAddressId: parsed.data.defaultAddressId,
      defaultAddressLabel: parsed.data.defaultAddressLabel
    },
    updatedAt: new Date().toISOString()
  };

  try {
    await saveProfile(uid, updated);
  } catch (err) {
    console.error("Address update failed", err);
    return NextResponse.json({ error: "Couldn't save that address." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
