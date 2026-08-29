import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUid } from "@/lib/session";
import { listSessions, createSession, titleFromMessage } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({ sessions: await listSessions(uid) });
}

export async function POST(req: Request) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ firstMessage: z.string().optional() }).safeParse(body);
  const title = titleFromMessage(parsed.success ? parsed.data.firstMessage ?? "" : "");
  return NextResponse.json({ session: await createSession(uid, title) });
}
