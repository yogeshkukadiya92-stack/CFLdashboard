import { normalizeLeadMobile } from "./lead-utils.ts";
import type { Lead } from "./types.ts";

export type LeadSort = "urgency" | "name" | "contact" | "city" | "quality";
const text = (value: string) => value.normalize("NFKC").toLocaleLowerCase().trim().replace(/\s+/g, " ");
export function matchesLeadSearch(lead: Lead, query: string): boolean {
  const term = text(query);
  if (!term) return true;
  // Phone queries allow formatting, but never turn text containing digits into a phone query.
  if (/^[+\d\s().-]+$/.test(term)) {
    const digits = term.replace(/\D/g, "");
    const mobile = lead.mobile.replace(/\D/g, "");
    const normalized = normalizeLeadMobile(term).replace(/\D/g, "");
    return Boolean(digits) && (mobile.includes(digits) || Boolean(normalized) && mobile.includes(normalized));
  }
  const values = [lead.name, lead.mobile, lead.email, lead.city, lead.state, lead.country, lead.interest || "", lead.id, lead.priority || "", lead.stage, ...lead.tags].map(text);
  return term.split(/\s+/).every(token => values.some(value => value.includes(token)));
}
export function lastContactTime(lead: Lead): number {
  return Math.max(0, ...(lead.activities || []).filter(activity => ["call", "whatsapp", "meeting"].includes(activity.type)).map(activity => Date.parse(activity.createdAt)).filter(Number.isFinite));
}
export function compareLeads(a: Lead, b: Lead, sort: LeadSort, descending: boolean): number {
  let result = 0;
  if (sort === "name" || sort === "city") {
    const first = a[sort]?.trim() || "", second = b[sort]?.trim() || "";
    if (!first || !second) return first ? -1 : second ? 1 : a.id.localeCompare(b.id);
    result = first.localeCompare(second, "en", { sensitivity: "base", numeric: true });
  }
  if (sort === "contact") {
    const first = lastContactTime(a), second = lastContactTime(b);
    if (!first || !second) return first ? -1 : second ? 1 : a.id.localeCompare(b.id);
    result = first - second;
  }
  if (sort === "quality") {
    const rank = { Hot: 3, Warm: 2, Cold: 1 };
    result = (rank[a.priority || "Warm"] - rank[b.priority || "Warm"]) || a.score - b.score;
  }
  return (descending ? -result : result) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id);
}
