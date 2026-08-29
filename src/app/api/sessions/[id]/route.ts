import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUid } from "@/lib/session";
import { getMessages, renameSession, deleteSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ messages: await getMessages(uid, id) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = z.object({ title: z.string().trim().min(1).max(80) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid title." }, { status: 400 });

  const { id } = await params;
  const ok = await renameSession(uid, id, parsed.data.title);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const ok = await deleteSession(uid, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
