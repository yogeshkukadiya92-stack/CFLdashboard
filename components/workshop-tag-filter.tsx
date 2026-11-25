"use client";

import { useState } from "react";
import { extractWorkshopTags, workshopHasTag, type WorkshopTagRecord } from "@/lib/workshop-tags";

export function useWorkshopTagFilter<T extends WorkshopTagRecord>(workshops: T[]) {
  const [tag, setTag] = useState("");
  const tags = Array.from(new Map(workshops.flatMap(extractWorkshopTags).map((value) => [value.toLowerCase(), value])).values()).sort((a, b) => a.localeCompare(b));
  const filtered = tag ? workshops.filter((workshop) => workshopHasTag(workshop, tag)) : workshops;
  return { tag, setTag, tags, filtered };
}

export function WorkshopTagFilter({ tag, setTag, tags }: { tag: string; setTag: (tag: string) => void; tags: string[] }) {
  return <label className="block text-xs font-bold text-slate-600">Workshop tag
    <select aria-label="Workshop tag" className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800" value={tag} onChange={(event) => setTag(event.target.value)}>
      <option value="">All tags</option>
      {tags.map((value) => <option key={value.toLowerCase()} value={value}>{value}</option>)}
    </select>
  </label>;
}
