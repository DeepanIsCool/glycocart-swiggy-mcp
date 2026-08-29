import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUid } from "@/lib/session";
import { getProfile, saveProfile } from "@/lib/db";
import { buildUserProfile } from "@/lib/profile";

export const runtime = "nodejs";

const answersSchema = z.object({
  displayName: z.string().trim().max(60).default(""),
  condition: z.enum(["general", "pcos", "pcos_ir", "prediabetes", "t2d"]),
  hba1c: z.coerce.number().min(3).max(20).optional(),
  fastingGlucose: z.coerce.number().min(40).max(400).optional(),
  crashes: z.enum(["never", "sometimes", "often"]),
  activity: z.enum(["sedentary", "light", "moderate", "very"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  age: z.coerce.number().min(12).max(100).optional(),
  sex: z.enum(["female", "male", "unspecified"]).optional(),
  heightCm: z.coerce.number().min(100).max(230).optional(),
  weightKg: z.coerce.number().min(25).max(300).optional(),
  dietary: z.array(z.string().trim().max(40)).max(20).default([]),
  blocklist: z.array(z.string().trim().max(40)).max(40).default([]),
  triggers: z.array(z.string().trim().max(40)).max(40).default([]),
  safeFoods: z.array(z.string().trim().max(40)).max(40).default([])
});

export async function GET() {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const profile = await getProfile(uid);
  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = answersSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some answers weren't valid.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const profile = buildUserProfile(uid, parsed.data);
  try {
    await saveProfile(uid, profile);
  } catch (err) {
    console.error("Saving profile failed", err);
    return NextResponse.json(
      { error: "Couldn't save your profile. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile });
}
