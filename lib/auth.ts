export const AUTH_COOKIE_NAME = "cfl_admin_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DEV_ADMIN_EMAIL = "coachforlife107@gmail.com";
const DEV_ADMIN_PASSWORD = "CFL12345";
const DEV_AUTH_SECRET = "cfl-local-master-login-secret-change-before-production";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function requiredEnv(name: "ADMIN_EMAIL" | "ADMIN_PASSWORD" | "AUTH_SECRET", fallback: string) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isProduction()) {
    throw new Error(`${name} must be configured in production.`);
  }
  return fallback;
}

export function getAdminEmail() {
  return requiredEnv("ADMIN_EMAIL", DEV_ADMIN_EMAIL);
}

export function getAdminPassword() {
  return requiredEnv("ADMIN_PASSWORD", DEV_ADMIN_PASSWORD);
}

function authSecret() {
  return requiredEnv("AUTH_SECRET", DEV_AUTH_SECRET);
}

function base64UrlEncode(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function signature(payload: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available in this runtime.");
  }

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret()),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signed = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signed));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export async function createAuthToken(email: string) {
  const payload = base64UrlEncode(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS }));
  const signed = await signature(payload);
  return `${payload}.${signed}`;
}

export async function verifyAuthToken(token?: string) {
  if (!token) return false;
  const [payload, signed] = token.split(".");
  if (!payload || !signed) return false;
  const expected = await signature(payload);
  if (!constantTimeEqual(signed, expected)) return false;

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as { email?: string; exp?: number };
    return data.email === getAdminEmail() && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}
