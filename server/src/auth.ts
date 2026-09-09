import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { pool } from "./db.js";

export const SESSION_COOKIE = "nivo_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function sessionCookie(token: string, maxAgeSeconds: number) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function sessionMaxAge() {
  return SESSION_DAYS * 86400;
}

export function readSessionToken(request: FastifyRequest): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')", [token, userId]);
  return token;
}

export async function deleteSession(token: string) {
  await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function lookupSession(token: string | null): Promise<{ userId: string; name: string; email: string; access: string } | null> {
  if (!token) return null;
  const result = await pool.query<{ user_id: string; name: string; email: string; role: string }>(
    `SELECT s.user_id, u.name, c.email, c.role FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN credentials c ON c.user_id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now() AND NOT c.disabled`,
    [token],
  );
  const row = result.rows[0];
  return row ? { userId: row.user_id, name: row.name, email: row.email, access: row.role } : null;
}

export async function findCredential(email: string): Promise<{ userId: string; passwordHash: string; disabled: boolean } | null> {
  const result = await pool.query<{ user_id: string; password_hash: string; disabled: boolean }>("SELECT user_id, password_hash, disabled FROM credentials WHERE lower(email) = lower($1)", [email]);
  const row = result.rows[0];
  return row ? { userId: row.user_id, passwordHash: row.password_hash, disabled: row.disabled } : null;
}
