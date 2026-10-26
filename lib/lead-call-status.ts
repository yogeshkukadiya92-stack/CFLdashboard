import type { Lead } from "./types.ts";

export function normalizeCallStatus(value: string) {
  return value.trim().replace(/[_\s-]+/g, " ").toLowerCase();
}

// CallFlow stores dispositions as call activities; later call logs do not
// replace the last disposition selected by the salesperson.
export function latestLeadCallStatus(lead: Pick<Lead, "activities" | "callHistory">) {
  const results = (lead.activities || [])
    .filter(activity => activity.type === "call" && activity.message.startsWith("Call result: "))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const message = results[0]?.message || [...(lead.callHistory || [])].reverse().find(item => item.startsWith("Call result: "));
  return message ? normalizeCallStatus(message.slice("Call result: ".length).split(" — ")[0]) : "";
}
