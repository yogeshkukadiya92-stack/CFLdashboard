"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { MapPin, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Row = {
  at?: string;
  checkedInAt?: string;
  id: string;
  latitude?: number;
  leadId?: string;
  location?: { accuracyMeters?: number; latitude?: number; longitude?: number };
  longitude?: number;
  salespersonName?: string;
  type?: string;
};

type LocationData = { checkIns: Row[]; shiftEvents: Row[] };
const emptyData: LocationData = { checkIns: [], shiftEvents: [] };

export default function LocationReport() {
  const [data, setData] = useState<LocationData>(emptyData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/callflow-locations", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as Partial<LocationData> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Location activity could not be loaded.");
      setData({
        checkIns: Array.isArray(payload.checkIns) ? payload.checkIns : [],
        shiftEvents: Array.isArray(payload.shiftEvents) ? payload.shiftEvents : []
      });
    } catch (loadError) {
      setData(emptyData);
      setError(loadError instanceof Error ? loadError.message : "Location activity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = [
    ...data.shiftEvents.map((row) => ({ ...row, kind: `Shift ${row.type || "event"}`, lat: row.location?.latitude, lng: row.location?.longitude, when: row.at })),
    ...data.checkIns.map((row) => ({ ...row, kind: "Meeting check-in", lat: row.latitude, lng: row.longitude, when: row.checkedInAt }))
  ].sort((a, b) => Date.parse(b.when || "") - Date.parse(a.when || ""));

  return (
    <AdminPlatformShell activeLabel="Location Report" title="Shift & Meeting Locations" description="Privacy-friendly event locations; continuous tracking is disabled.">
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800" role="alert">
          <span>{error}</span>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-xs font-black text-rose-700" onClick={() => void load()} type="button"><RefreshCw className="size-4" />Retry</button>
        </div>
      ) : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div className="flex flex-wrap items-center gap-4 p-4" key={row.id}>
              <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><MapPin className="size-5" /></span>
              <div className="min-w-52 flex-1">
                <p className="font-black">{row.salespersonName || "Salesperson"} · {row.kind}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{row.when ? new Date(row.when).toLocaleString("en-IN") : "—"}{row.leadId ? ` · Lead ${row.leadId}` : ""}</p>
              </div>
              {Number.isFinite(row.lat) && Number.isFinite(row.lng) ? <a className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white" href={`https://www.google.com/maps?q=${row.lat},${row.lng}`} rel="noreferrer" target="_blank">OPEN MAP</a> : <span className="text-xs font-bold text-slate-400">No location</span>}
            </div>
          ))}
          {!loading && !error && !rows.length ? <p className="p-12 text-center font-bold text-slate-500">No location events yet.</p> : null}
          {loading ? <p className="p-12 text-center font-bold text-slate-500">Loading location events…</p> : null}
        </div>
      </section>
    </AdminPlatformShell>
  );
}
