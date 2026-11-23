"use client";
import { useState, useEffect } from "react";
import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { featureGroups, primaryTag, type TagPolicy } from "@/lib/tag-features";
import { hydrateLiveState, readLocalArray, LIVE_STATE_STORAGE_KEYS } from "@/lib/live-state";
import { extractWorkshopTags } from "@/lib/workshop-tags";

export default function TagFeatures() {
  const [policies, setPolicies] = useState<TagPolicy[]>([]);
  const [existing, setExisting] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [disabled, setDisabled] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void fetch("/api/settings/tag-features").then(async response => {
      if (!response.ok) throw Error();
      setPolicies(await response.json());
      setReady(true);
    }).catch(() => setMessage("Could not load settings. Refresh to retry."));
    void hydrateLiveState().then(() => setExisting(readLocalArray<Parameters<typeof extractWorkshopTags>[0]>(LIVE_STATE_STORAGE_KEYS.workshops).flatMap(extractWorkshopTags)));
  }, []);
  function select(value: string) {
    setName(value);
    setMessage("");
    setDisabled(policies.find(policy => primaryTag(policy.name) === primaryTag(value))?.disabled ?? []);
  }
  function toggle(items: string[], enabled: boolean) {
    setDisabled(previous => enabled ? previous.filter(item => !items.includes(item)) : Array.from(new Set([...previous, ...items])));
  }
  async function save() {
    setReady(false);
    try {
      const policy = {name:name.trim(), disabled};
      const result = await fetch("/api/settings/tag-features", {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(policy)});
      if (!result.ok) throw Error();
      setPolicies(previous => [...previous.filter(item => primaryTag(item.name) !== primaryTag(name)), policy]);
      setMessage("Settings saved.");
    } catch { setMessage("Could not save settings. Please retry."); }
    finally { setReady(true); }
  }
  return <AdminPlatformShell title="Tag features" activeLabel="Settings" description="Choose the workshop setup options available for each primary tag.">
    <fieldset disabled={!ready} className="max-w-3xl space-y-4 rounded-xl bg-white p-5">
      <label className="block font-bold">Workshop tag<input list="tags" className="mt-2 block w-full rounded-lg border p-3" placeholder="Select or enter a tag" value={name} onChange={e => select(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2" aria-label="Existing workshop tags">{Array.from(new Set([...existing,...policies.map(p => p.name)])).sort().map(tag => <button type="button" key={tag} onClick={() => select(tag)} aria-pressed={primaryTag(name) === primaryTag(tag)} className={`rounded-lg border px-3 py-2 ${primaryTag(name) === primaryTag(tag) ? "bg-emerald-700 text-white" : "bg-white text-slate-700"}`}>{tag}</button>)}</div>
      <datalist id="tags">{Array.from(new Set([...existing,...policies.map(p => p.name)])).sort().map(tag => <option key={tag}>{tag}</option>)}</datalist>
      {Object.entries(featureGroups).map(([group, items]) => <fieldset key={group} className="rounded-lg border p-4">
        <legend className="px-2 font-bold"><label><input type="checkbox" checked={items.every(item => !disabled.includes(item))} onChange={e => toggle(items,e.target.checked)} /> {group}</label></legend>
        <div className="grid gap-3 sm:grid-cols-2">{items.map(item => <label key={item}><input type="checkbox" checked={!disabled.includes(item)} onChange={e => toggle([item],e.target.checked)} /> {item}</label>)}</div>
      </fieldset>)}
      <button disabled={!name.trim() || name.includes(",")} className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" onClick={save}>Save tag features</button>
    </fieldset><p role="status">{message}</p>
  </AdminPlatformShell>;
}
