import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import type { AttendanceTeamUser, AttendanceTeamUserSummary } from "@/lib/types";

export const ATTENDANCE_TEAM_COOKIE = "cfl_attendance_team_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function secret() {
  const value = process.env.ATTENDANCE_TEAM_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("ATTENDANCE_TEAM_SECRET or AUTH_SECRET must be configured in production.");
  return "cfl-local-attendance-team-secret-change-before-production";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  return left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function hashAttendanceTeamPassword(password: string, email: string) {
  const salt = sign(`password-salt:${email.trim().toLowerCase()}`);
  return scryptSync(password, salt, 64).toString("hex");
}

export function verifyAttendanceTeamPassword(password: string, user: AttendanceTeamUser) {
  return safeEqual(hashAttendanceTeamPassword(password, user.email), user.passwordHash);
}

export function createAttendanceTeamSession(user: AttendanceTeamUser) {
  const grantExpiry = user.expiresAt ? new Date(user.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
  const expiresAt = Math.min(Date.now() + SESSION_TTL_SECONDS * 1000, grantExpiry);
  const payload = Buffer.from(JSON.stringify({ userId: user.id, email: user.email, expiresAt })).toString("base64url");
  return `${payload}.${sign(`session:${payload}`)}`;
}

export function verifyAttendanceTeamSession(value: string | undefined, user: AttendanceTeamUser) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(sign(`session:${payload}`), signature)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; email?: string; expiresAt?: number };
    return decoded.userId === user.id && decoded.email === user.email && typeof decoded.expiresAt === "number" && decoded.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function attendanceTeamSessionMaxAge(user: AttendanceTeamUser) {
  if (!user.expiresAt) return SESSION_TTL_SECONDS;
  return Math.max(1, Math.min(SESSION_TTL_SECONDS, Math.floor((new Date(user.expiresAt).getTime() - Date.now()) / 1000)));
}

export function attendanceTeamUserExpired(user: AttendanceTeamUser) {
  return Boolean(user.expiresAt && new Date(user.expiresAt).getTime() <= Date.now());
}

export function toAttendanceTeamSummary(user: AttendanceTeamUser): AttendanceTeamUserSummary {
  const { passwordHash: _passwordHash, ...summary } = user;
  return { ...summary, hasPassword: Boolean(user.passwordHash) };
}
