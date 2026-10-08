export type IntroductionStatus = { id: string; label: string; isConfirmed: boolean; active: boolean };
export const defaultIntroductionStatuses: IntroductionStatus[] = [
  { id: "pending", label: "Pending", isConfirmed: false, active: true },
  { id: "confirmed", label: "Confirmed", isConfirmed: true, active: true },
  { id: "not_confirmed", label: "Not confirmed", isConfirmed: false, active: true },
  { id: "no_answer", label: "No answer", isConfirmed: false, active: true },
  { id: "callback", label: "Call back", isConfirmed: false, active: true },
  { id: "cancelled", label: "Cancelled", isConfirmed: false, active: true },
  { id: "carried_forward", label: "Carried forward", isConfirmed: false, active: false },
  { id: "repeater", label: "Repeater", isConfirmed: false, active: false },
];
export function introductionStatuses(integrations: Record<string, unknown>): IntroductionStatus[] {
  const config = integrations.callFlowContent as { introductionStatuses?: IntroductionStatus[] } | undefined;
  return Array.isArray(config?.introductionStatuses) ? config.introductionStatuses : defaultIntroductionStatuses;
}
export function validateIntroductionStatuses(value: unknown, previous: IntroductionStatus[]): IntroductionStatus[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new Error("Add between 1 and 100 statuses.");
  const ids = new Set<string>(), labels = new Set<string>();
  const result = value.map((item: unknown) => {
    const row = item as Partial<IntroductionStatus> | null;
    if (!row || typeof row.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) || typeof row.label !== "string" || typeof row.active !== "boolean" || typeof row.isConfirmed !== "boolean") throw new Error("Invalid status details.");
    const label = row.label.trim();
    if (!label || label.length > 80) throw new Error("Each status needs a name of up to 80 characters.");
    if (ids.has(row.id) || labels.has(label.toLocaleLowerCase())) throw new Error("Status names must be unique.");
    ids.add(row.id); labels.add(label.toLocaleLowerCase());
    const system = defaultIntroductionStatuses.find(status => status.id === row.id);
    return { id: row.id, label, active: row.active, isConfirmed: system ? system.isConfirmed : row.isConfirmed };
  });
  if (previous.some(status => !ids.has(status.id))) throw new Error("Keep existing statuses; make unused statuses inactive to preserve history.");
  if (!result.some(status => status.active)) throw new Error("Keep at least one active status.");
  return result;
}
