export interface WorkshopTagRecord {
  name: string;
  type?: string;
  facilitator?: string;
  productGroup?: string;
  isPaid?: boolean;
  tag?: string;
  tags?: string[];
  archived?: boolean;
  id?: string;
}

/**
 * Normalizes workshop tag input into a primary display string and an array of individual tags.
 * Example: " LP, BJS " -> { tag: "LP, BJS", tags: ["LP", "BJS"] }
 */
export function normalizeWorkshopTag(tagInput: string): { tag: string; tags: string[] } {
  if (!tagInput || typeof tagInput !== "string") {
    return { tag: "", tags: [] };
  }
  const rawParts = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
  const uniqueTags = Array.from(new Set(rawParts));
  return {
    tag: uniqueTags.join(", "),
    tags: uniqueTags
  };
}

/**
 * Validates that the tag input is non-empty (compulsory).
 */
export function isWorkshopTagProvided(tagInput: string | null | undefined): boolean {
  return Boolean(tagInput && tagInput.trim().length > 0);
}

/**
 * Extracts a deduplicated array of tags for a given workshop record.
 */
export function extractWorkshopTags(record: WorkshopTagRecord): string[] {
  const set = new Set<string>();
  if (Array.isArray(record.tags)) {
    record.tags.forEach((t) => {
      const clean = t?.trim();
      if (clean) set.add(clean);
    });
  }
  if (record.tag) {
    record.tag.split(",").forEach((t) => {
      const clean = t.trim();
      if (clean) set.add(clean);
    });
  }
  return Array.from(set);
}

/**
 * Checks whether a workshop record has been assigned a specific tag (case-insensitive exact tag match).
 */
export function workshopHasTag(record: WorkshopTagRecord, targetTag: string): boolean {
  const cleanTarget = targetTag.trim().toLowerCase();
  if (!cleanTarget) return false;
  const tags = extractWorkshopTags(record);
  return tags.some((t) => t.toLowerCase() === cleanTarget);
}

/**
 * Groups workshops by tag and returns a list of tags with their counts and assigned workshops.
 */
export function groupWorkshopsByTag<T extends WorkshopTagRecord>(workshops: T[]): Array<{
  tag: string;
  count: number;
  paidCount: number;
  freeCount: number;
  workshops: T[];
}> {
  const map = new Map<string, { tag: string; count: number; paidCount: number; freeCount: number; workshops: T[] }>();

  workshops.forEach((workshop) => {
    if (workshop.archived) return;
    const tags = extractWorkshopTags(workshop);
    tags.forEach((t) => {
      const key = t.toLowerCase();
      const existing = map.get(key) ?? {
        tag: t,
        count: 0,
        paidCount: 0,
        freeCount: 0,
        workshops: []
      };
      existing.count += 1;
      if (workshop.isPaid) {
        existing.paidCount += 1;
      } else {
        existing.freeCount += 1;
      }
      existing.workshops.push(workshop);
      map.set(key, existing);
    });
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Checks whether a workshop record matches a search term across its name, tag, tags array,
 * facilitator, workshop type, and product group.
 */
export function workshopMatchesSearch(record: WorkshopTagRecord, query: string): boolean {
  const value = query.trim().toLowerCase();
  if (!value) return true;

  const tagList = Array.isArray(record.tags) ? record.tags : [];
  const tagStr = [record.tag ?? "", ...tagList].join(" ");
  const paymentStr = record.isPaid ? "paid" : "free";

  return [
    record.name,
    record.type ?? "",
    record.facilitator ?? "",
    record.productGroup ?? "",
    tagStr,
    paymentStr
  ].some((item) => item.toLowerCase().includes(value));
}
