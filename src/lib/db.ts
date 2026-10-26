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

export function sqlClient() {
  return client();
}

/** Ensure tables exist before another module queries them directly. */
export async function ensureSchemaReady() {
  await ensureSchema();
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
  await sql`
    create table if not exists chat_sessions (
      id          text primary key,
      user_id     text not null,
      title       text not null,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    )
  `;
  await sql`create index if not exists chat_sessions_user_idx on chat_sessions (user_id, updated_at desc)`;
  await sql`
    create table if not exists chat_messages (
      id                bigserial primary key,
      session_id        text not null references chat_sessions(id) on delete cascade,
      role              text not null,
      content           text,
      tool_invocations  jsonb,
      created_at        timestamptz not null default now()
    )
  `;
  await sql`create index if not exists chat_messages_session_idx on chat_messages (session_id, id)`;
  await sql`
    create table if not exists daily_log (
      user_id     text not null,
      day         date not null,
      entries     jsonb not null default '[]'::jsonb,
      updated_at  timestamptz not null default now(),
      primary key (user_id, day)
    )
  `;
  // Swiggy's cart names its restaurant but never returns its id, which every
  // cart change needs. Remembered here from the last successful add, by the
  // agent or the UI alike.
  await sql`
    create table if not exists cart_context (
      user_id          text primary key,
      restaurant_id    text not null,
      restaurant_name  text not null,
      updated_at       timestamptz not null default now()
    )
  `;
  // Salted hashes of the account's saved address ids, used to tell accounts
  // apart when the access token has no subject (see account-match.ts).
  await sql`
    create table if not exists account_addresses (
      user_id    text not null,
      addr_hash  text not null,
      primary key (user_id, addr_hash)
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

/**
 * Right to erasure. Chat transcripts and the daily log are health-adjacent
 * data too, so deleting "my data" must remove all of it, not just the profile.
 * chat_messages cascades from chat_sessions.
 */
export async function deleteProfile(uid: string): Promise<void> {
  await ensureSchema();
  const sql = client();
  await sql`delete from chat_sessions where user_id = ${uid}`;
  await sql`delete from daily_log where user_id = ${uid}`;
  await sql`delete from cart_context where user_id = ${uid}`;
  await sql`delete from account_addresses where user_id = ${uid}`;
  await sql`delete from user_profiles where id = ${uid}`;
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

export async function getCartRestaurant(uid: string): Promise<{ id: string; name: string } | null> {
  await ensureSchema();
  const sql = client();
  const rows = (await sql`select restaurant_id, restaurant_name from cart_context where user_id = ${uid}`) as {
    restaurant_id: string;
    restaurant_name: string;
  }[];
  return rows[0] ? { id: rows[0].restaurant_id, name: rows[0].restaurant_name } : null;
}

export async function setCartRestaurant(uid: string, id: string, name: string): Promise<void> {
  await ensureSchema();
  const sql = client();
  await sql`
    insert into cart_context (user_id, restaurant_id, restaurant_name)
    values (${uid}, ${id}, ${name})
    on conflict (user_id) do update
      set restaurant_id = excluded.restaurant_id,
          restaurant_name = excluded.restaurant_name,
          updated_at = now()
  `;
}

export async function getAccountAddresses(uid: string): Promise<string[]> {
  await ensureSchema();
  const sql = client();
  const rows = (await sql`select addr_hash from account_addresses where user_id = ${uid}`) as { addr_hash: string }[];
  return rows.map((r) => r.addr_hash);
}

export async function addAccountAddresses(uid: string, hashes: string[]): Promise<void> {
  if (hashes.length === 0) return;
  await ensureSchema();
  const sql = client();
  await sql`
    insert into account_addresses (user_id, addr_hash)
    select ${uid}, unnest(${hashes}::text[])
    on conflict do nothing
  `;
}
