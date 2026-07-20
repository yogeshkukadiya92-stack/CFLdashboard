import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ResponseAccessGrant, ResponseAccessGrantSummary } from "@/lib/types";

export const RESPONSE_VIEWER_COOKIE = "cfl_response_viewer_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function accessSecret() {
  const value = process.env.RESPONSE_ACCESS_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RESPONSE_ACCESS_SECRET or AUTH_SECRET must be configured in production.");
  }
  return "cfl-local-response-access-secret-change-before-production";
}

function sign(value: string) {
  return createHmac("sha256", accessSecret()).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function generateResponseAccessToken() {
  return randomBytes(24).toString("base64url");
}

export function hashResponseAccessCode(code: string, token: string) {
  return sign(`code:${token}:${code}`);
}

export function verifyResponseAccessCode(code: string, token: string, expectedHash: string) {
  return safeEqual(hashResponseAccessCode(code, token), expectedHash);
}

export function createResponseViewerSession(grant: ResponseAccessGrant) {
  const expiresAt = Math.min(
    Date.now() + SESSION_TTL_SECONDS * 1000,
    grant.expiresAt ? new Date(grant.expiresAt).getTime() : Number.MAX_SAFE_INTEGER
  );
  const payload = Buffer.from(JSON.stringify({ grantId: grant.id, token: grant.token, expiresAt })).toString("base64url");
  return `${payload}.${sign(`session:${payload}`)}`;
}

export function verifyResponseViewerSession(value: string | undefined, grant: ResponseAccessGrant) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(sign(`session:${payload}`), signature)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { expiresAt?: number; grantId?: string; token?: string };
    return decoded.grantId === grant.id && decoded.token === grant.token && typeof decoded.expiresAt === "number" && decoded.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function responseViewerSessionMaxAge(grant: ResponseAccessGrant) {
  if (!grant.expiresAt) return SESSION_TTL_SECONDS;
  return Math.max(1, Math.min(SESSION_TTL_SECONDS, Math.floor((new Date(grant.expiresAt).getTime() - Date.now()) / 1000)));
}

export function isResponseAccessExpired(grant: ResponseAccessGrant) {
  return Boolean(grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now());
}

export function toResponseAccessSummary(grant: ResponseAccessGrant): ResponseAccessGrantSummary {
  const { pinHash: _pinHash, ...summary } = grant;
  return { ...summary, hasAccessCode: Boolean(grant.pinHash) };
}

export function maskResponseMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  const lastFour = digits.slice(-4);
  return lastFour ? `+91 ******${lastFour}` : "Hidden";
}

export function maskResponseEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return value ? "Hidden" : "";
  return `${local.slice(0, 1) || "*"}***@${domain}`;
}
