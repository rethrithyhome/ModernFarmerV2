/**
 * Minimal Supabase Auth client — email/password only, using the same raw-fetch style as
 * cloud.ts (no @supabase/supabase-js dependency). A session is only ever needed when
 * cloud sync is configured (see readCloudConfig in ./cloud); pure device-only mode never
 * touches this file.
 */
import type { CloudConfig } from "./cloud";

const SESSION_KEY = "dijii.auth.session.v1";

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  user: { id: string; email: string };
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: session just won't survive a reload this time */
  }
}

export const readSession = (): Session | null => readJson<Session | null>(SESSION_KEY, null);

function writeSession(session: Session | null) {
  writeJson(SESSION_KEY, session);
}

export class AuthError extends Error {}

async function authCall(cfg: CloudConfig, path: string, body: unknown) {
  const response = await fetch(`${cfg.url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}) as Record<string, unknown>);
  if (!response.ok) {
    const message =
      (data as { error_description?: string; msg?: string }).error_description ??
      (data as { msg?: string }).msg ??
      "ចូលប្រើប្រាស់មិនបានទេ";
    throw new AuthError(message);
  }
  return data as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { id: string; email: string };
  };
}

function toSession(data: Awaited<ReturnType<typeof authCall>>): Session {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    user: { id: data.user.id, email: data.user.email },
  };
}

export async function signIn(cfg: CloudConfig, email: string, password: string): Promise<Session> {
  const data = await authCall(cfg, "token?grant_type=password", { email, password });
  const session = toSession(data);
  writeSession(session);
  return session;
}

export function signOut() {
  writeSession(null);
}

async function refreshSession(cfg: CloudConfig): Promise<Session | null> {
  const current = readSession();
  if (!current) return null;
  try {
    const data = await authCall(cfg, "token?grant_type=refresh_token", {
      refresh_token: current.refresh_token,
    });
    const session = toSession(data);
    writeSession(session);
    return session;
  } catch {
    writeSession(null);
    return null;
  }
}

export type Role = "admin" | "stock" | "sale";

/** Null means the account has no profile row yet — an admin needs to assign a role. */
export async function fetchMyRole(cfg: CloudConfig, session: Session): Promise<Role | null> {
  const response = await fetch(`${cfg.url}/rest/v1/profiles?id=eq.${session.user.id}&select=role`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => [] as { role?: string }[]);
  const role = Array.isArray(rows) ? rows[0]?.role : undefined;
  return role === "admin" || role === "stock" || role === "sale" ? role : null;
}

/** Returns a session guaranteed to be valid for at least another minute, refreshing if needed. */
export async function validSession(cfg: CloudConfig): Promise<Session | null> {
  const current = readSession();
  if (!current) return null;
  const now = Math.floor(Date.now() / 1000);
  if (current.expires_at - now > 60) return current;
  return refreshSession(cfg);
}
