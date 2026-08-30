import { randomUUID } from "crypto";
import { sqlClient, ensureSchemaReady } from "./db";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  role: "user" | "assistant";
  content: string | null;
  toolInvocations: unknown | null;
}

/** Derive a readable title from the first thing the user actually asked. */
export function titleFromMessage(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  // The sidebar wraps to two lines, so titles have room for a full question.
  return clean.length > 64 ? `${clean.slice(0, 61)}…` : clean;
}

export async function listSessions(uid: string): Promise<ChatSession[]> {
  await ensureSchemaReady();
  const sql = sqlClient();
  const rows = (await sql`
    select id, title, created_at, updated_at
    from chat_sessions where user_id = ${uid}
    order by updated_at desc limit 50
  `) as any[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString()
  }));
}

export async function createSession(uid: string, title: string): Promise<ChatSession> {
  await ensureSchemaReady();
  const sql = sqlClient();
  const id = randomUUID();
  await sql`insert into chat_sessions (id, user_id, title) values (${id}, ${uid}, ${title})`;
  const now = new Date().toISOString();
  return { id, title, createdAt: now, updatedAt: now };
}

/** Ownership is checked on every read/write — a session id is not a capability. */
export async function ownsSession(uid: string, sessionId: string): Promise<boolean> {
  await ensureSchemaReady();
  const sql = sqlClient();
  const rows = (await sql`select 1 from chat_sessions where id = ${sessionId} and user_id = ${uid}`) as any[];
  return rows.length > 0;
}

export async function getMessages(uid: string, sessionId: string): Promise<StoredMessage[]> {
  if (!(await ownsSession(uid, sessionId))) return [];
  const sql = sqlClient();
  const rows = (await sql`
    select role, content, tool_invocations
    from chat_messages where session_id = ${sessionId} order by id asc
  `) as any[];
  return rows.map((r) => ({
    role: r.role,
    content: r.content,
    toolInvocations: r.tool_invocations
  }));
}

export async function appendMessages(
  uid: string,
  sessionId: string,
  messages: StoredMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  if (!(await ownsSession(uid, sessionId))) return;
  const sql = sqlClient();
  for (const m of messages) {
    await sql`
      insert into chat_messages (session_id, role, content, tool_invocations)
      values (${sessionId}, ${m.role}, ${m.content},
              ${m.toolInvocations ? JSON.stringify(m.toolInvocations) : null}::jsonb)
    `;
  }
  await sql`update chat_sessions set updated_at = now() where id = ${sessionId}`;
}

export async function renameSession(uid: string, sessionId: string, title: string): Promise<boolean> {
  if (!(await ownsSession(uid, sessionId))) return false;
  const sql = sqlClient();
  await sql`update chat_sessions set title = ${title}, updated_at = now() where id = ${sessionId}`;
  return true;
}

export async function deleteSession(uid: string, sessionId: string): Promise<boolean> {
  if (!(await ownsSession(uid, sessionId))) return false;
  const sql = sqlClient();
  // chat_messages cascades.
  await sql`delete from chat_sessions where id = ${sessionId}`;
  return true;
}
