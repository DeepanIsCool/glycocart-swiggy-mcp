import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ops diagnostic: is the runtime actually configured, and can it reach the
 * database? Reports presence booleans and a connectivity result only — never
 * the connection string, credentials, or any row data.
 */
export async function GET() {
  const url = process.env.DATABASE_URL;

  const config = {
    DATABASE_URL: !!url,
    SWIGGY_TOKEN_SECRET: !!process.env.SWIGGY_TOKEN_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
    NVIDIA_API_KEY: !!process.env.NVIDIA_API_KEY,
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY
  };

  if (!url) {
    return NextResponse.json(
      { ok: false, reason: "DATABASE_URL missing from this deployment", config },
      { status: 503 }
    );
  }

  try {
    const sql = neon(url);
    const rows = (await sql`select to_regclass('public.user_profiles') as table_exists`) as {
      table_exists: string | null;
    }[];
    return NextResponse.json({
      ok: true,
      connected: true,
      profilesTableExists: !!rows[0]?.table_exists,
      config
    });
  } catch (err) {
    // The message can contain host details but never the password; still, keep
    // it to the first line so a stack trace can't drag anything else along.
    const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return NextResponse.json({ ok: false, connected: false, error: message, config }, { status: 503 });
  }
}
