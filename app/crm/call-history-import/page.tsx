"use client";

import { useState } from "react";
import { AdminPlatformShell } from "@/components/admin-platform-shell";

export default function CallHistoryImportPage() {
  const [file, setFile] = useState<File>();
  const [previewed, setPreviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(preview: boolean) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/call-history-import" + (preview ? "?preview=1" : ""), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await file.text(),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Import failed.");
      setPreviewed(preview);
      setMessage(preview ? `${result.ready} records ready for ${result.salespeople.join(", ")}.` :
        `Imported ${result.imported} records. ${result.alreadyImported} already existed.`);
    } catch (error) {
      setPreviewed(false);
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally { setBusy(false); }
  }
  return <AdminPlatformShell title="Import call history" description="Add prepared external call records to the CFL dashboard and assigned CallFlow accounts." activeLabel="CRM">
    <section className="grid max-w-xl gap-4 rounded-xl bg-white p-5">
      <label className="grid gap-2">Prepared call history file<input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
        setFile(event.target.files?.[0]); setPreviewed(false); setMessage("");
      }} /></label>
      <div className="flex gap-4">
        <button className="rounded-lg border px-4 py-2 disabled:opacity-50" disabled={!file || busy} onClick={() => void submit(true)}>Preview</button>
        <button className="rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50" disabled={!previewed || busy} onClick={() => void submit(false)}>Import calls</button>
      </div>
      <p role="status">{busy ? "Checking file…" : message}</p>
    </section>
  </AdminPlatformShell>;
}
