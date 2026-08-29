import { neon } from "@neondatabase/serverless";
import type { UserProfile } from "./profile";

/**
 * Neon Postgres (provisioned via `vercel install neon`, which injects DATABASE_URL).
 *
 * One table, JSONB payload: onboarding fields change often early on, and a
 * schema migration per field change would be pure overhead. Relational tables
 * (meal logs, order history) can sit alongside it later.
 */

let initialised = false;

/**
 * Vercel's Neon Marketplace integration injects its variables with a STORAGE_
 * prefix, so accept both that and a plain DATABASE_URL (used locally, or when
 * the connection string is set by hand). Pooled endpoints first — that's what
 * serverless functions should be talking to.
 */
export function resolveDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.STORAGE_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    undefined
  );
}

function client() {
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error(
      "No database connection string found. Expected DATABASE_URL or STORAGE_DATABASE_URL in the environment."
    );
  }
  return neon(url);
}

async function ensureSchema() {
  if (initialised) return;
  const sql = client();
  await sql`
    create table if not exists user_profiles (
      id          text primary key,
      profile     jsonb not null,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    )
  `;
  initialised = true;
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  await ensureSchema();
  const sql = client();
  const rows = (await sql`select profile from user_profiles where id = ${uid}`) as { profile: UserProfile }[];
  return rows[0]?.profile ?? null;
}

export async function saveProfile(uid: string, profile: UserProfile): Promise<void> {
  await ensureSchema();
  const sql = client();
  await sql`
    insert into user_profiles (id, profile)
    values (${uid}, ${JSON.stringify(profile)}::jsonb)
    on conflict (id) do update
      set profile = excluded.profile,
          updated_at = now()
  `;
}
