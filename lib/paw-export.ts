type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const str = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function pawExport(state: { registrationLinks?: Record<string, unknown>; workshops?: unknown[]; registrations?: unknown[] }, allowedIds: string[] = []) {
  const masters = (state.workshops || []).map(row);
  const links = Object.values(state.registrationLinks || {}).map(row);
  // Include saved masters before a registration link or participant exists.
  const sourceIds = [...new Set([...links, ...masters].map(w => str(w.id)).filter(Boolean))];
  const workshops = sourceIds.flatMap(id => {
    const master = masters.find(w => w.id === id);
    const link = links.find(w => w.id === id);
    const title = str(link?.title) || str(master?.name);
    const enabled = master?.pawSyncEnabled;
    const selected = typeof enabled === 'boolean' ? enabled : allowedIds.includes(id) || /\bPAW\b|personality awareness workshop/i.test(`${title} ${str(master?.name)}`);
    if (!selected || !title) return [];
    return [{ id, title, type: str(master?.type), venue: str(link?.venue), startDate: str(master?.startDate), endDate: str(master?.endDate) }];
  });
  const ids = new Set(workshops.map(w => w.id));
  const registrations = (state.registrations || []).map(row).filter(r => ids.has(str(r.workshopId))).map(r => ({
    id: str(r.id), workshopId: str(r.workshopId), fullName: str(r.fullName), mobile: str(r.mobile), email: str(r.email), city: str(r.city), createdAt: str(r.createdAt), registrationNumber: str(r.registrationNumber), registrationStatus: str(r.registrationStatus) || 'confirmed'
  }));
  return { version: 1, workshops, registrations };
}
