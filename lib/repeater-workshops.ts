// Historical state can contain partial workshop records without a name.
// Keep those records stored, but do not offer them as repeater sources.
export function filterRepeaterWorkshops<T extends { id?: string; name?: unknown }>(
  workshops: T[], editingId: string | null, query: string
): T[] {
  const search = query.trim().toLowerCase();
  return workshops.filter((workshop) =>
    workshop.id !== editingId &&
    typeof workshop.name === "string" &&
    Boolean(workshop.name.trim()) &&
    workshop.name.toLowerCase().includes(search)
  );
}
