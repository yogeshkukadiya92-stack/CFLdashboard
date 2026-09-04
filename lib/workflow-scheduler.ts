import type { WorkflowNode } from "./workflow-studio.ts";

const offsets: Record<string, number> = { "Asia/Kolkata": 330, UTC: 0 };
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ScheduleDefinition = { frequency: "hourly" | "daily" | "weekly" | "once"; minute: number; hour: number; weekdays: string[]; timezone: keyof typeof offsets; scheduledAt?: string };

export function scheduleDefinition(node: WorkflowNode): ScheduleDefinition | null {
  if (node.kind !== "delay" || (node.config.scheduleEnabled !== true && !["Scheduled time", "Schedule for date"].includes(node.title))) return null;
  const frequency = String(node.config.frequency || (node.title === "Schedule for date" ? "once" : "daily"));
  if (!["hourly", "daily", "weekly", "once"].includes(frequency)) return null;
  const [rawHour, rawMinute] = String(node.config.time || "09:00").split(":").map(Number);
  const timezone = String(node.config.timezone || "Asia/Kolkata") as keyof typeof offsets;
  return { frequency: frequency as ScheduleDefinition["frequency"], hour: Math.min(23, Math.max(0, Number.isFinite(rawHour) ? rawHour : 9)), minute: Math.min(59, Math.max(0, Number.isFinite(rawMinute) ? rawMinute : 0)), weekdays: Array.isArray(node.config.weekdays) ? node.config.weekdays.map(String).filter((day) => days.includes(day)) : ["Mon", "Tue", "Wed", "Thu", "Fri"], timezone: timezone in offsets ? timezone : "Asia/Kolkata", scheduledAt: String(node.config.scheduledAt || "") || undefined };
}

function localParts(date: Date, timezone: keyof typeof offsets) {
  const shifted = new Date(date.getTime() + offsets[timezone] * 60_000);
  return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), day: days[shifted.getUTCDay()] };
}

export function scheduleIsDue(node: WorkflowNode, now = new Date()) {
  const schedule = scheduleDefinition(node);
  if (!schedule) return false;
  if (schedule.frequency === "once") {
    const target = new Date(schedule.scheduledAt || "");
    return Number.isFinite(target.getTime()) && Math.floor(target.getTime() / 60_000) === Math.floor(now.getTime() / 60_000);
  }
  const local = localParts(now, schedule.timezone);
  if (schedule.frequency === "hourly") return local.minute === schedule.minute;
  if (schedule.frequency === "daily") return local.hour === schedule.hour && local.minute === schedule.minute;
  return schedule.weekdays.includes(local.day) && local.hour === schedule.hour && local.minute === schedule.minute;
}

export function nextScheduleAt(node: WorkflowNode, now = new Date()) {
  const schedule = scheduleDefinition(node);
  if (!schedule) return null;
  if (schedule.frequency === "once") { const target = new Date(schedule.scheduledAt || ""); return target.getTime() > now.getTime() ? target.toISOString() : null; }
  const start = Math.floor(now.getTime() / 60_000) * 60_000 + 60_000;
  for (let offset = 0; offset <= 8 * 24 * 60; offset += 1) {
    const candidate = new Date(start + offset * 60_000);
    if (scheduleIsDue(node, candidate)) return candidate.toISOString();
  }
  return null;
}
