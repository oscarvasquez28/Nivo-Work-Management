import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyRequest } from "fastify";
import type { SessionUser } from "../../types/domain";
import { pool, type Tx } from "./db";

export const SESSION_COOKIE = "nivo_session";
const derive = promisify(scrypt);
type Database = Pick<Tx, "query">;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt, 64) as Buffer).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const derived = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(derived, Buffer.from(hash, "hex"));
}

export const sessionMaxAge = () => 30 * 86400;
export function sessionCookie(token: string, maxAgeSeconds: number, secure = false) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

export function readSessionToken(request: FastifyRequest): string | null {
  const value = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export async function createSession(userId: string, db: Database = pool): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')", [token, userId]);
  return token;
}

export async function deleteSession(token: string, db: Database = pool) {
  await db.query("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function lookupSession(token: string | null, db: Database = pool): Promise<SessionUser | null> {
  if (!token) return null;
  const result = await db.query<{ id: string; name: string; email: string; access: "admin" | "member" }>(
    `SELECT u.id, u.name, c.email, c.role AS access FROM sessions s JOIN users u ON u.id = s.user_id
     JOIN credentials c ON c.user_id = u.id WHERE s.token = $1 AND s.expires_at > now() AND NOT c.disabled`, [token]);
  return result.rows[0] ?? null;
}

export async function findCredential(email: string, db: Database = pool): Promise<{ userId: string; passwordHash: string; disabled: boolean } | null> {
  const result = await db.query<{ user_id: string; password_hash: string; disabled: boolean }>("SELECT user_id, password_hash, disabled FROM credentials WHERE lower(trim(email)) = $1", [email.trim().toLowerCase()]);
  const row = result.rows[0];
  return row ? { userId: row.user_id, passwordHash: row.password_hash, disabled: row.disabled } : null;
}
