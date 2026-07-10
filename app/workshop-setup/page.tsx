"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { Check, Edit3, Plus, RefreshCw, Search, Trash2, UserRound, Workflow } from "lucide-react";
import { hydrateLiveState, readLocalArray, saveLiveState } from "@/lib/live-state";
import { generateId } from "@/lib/utils";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

type MasterRecord = {
  id: string;
  name: string;
};

type MasterKind = "workshopType" | "facilitator";

const WORKSHOP_TYPES_STORAGE_KEY = "cfl_workshop_types_v1";
const FACILITATORS_STORAGE_KEY = "cfl_facilitators_v1";
const defaultWorkshopTypes = ["1-2-1 Coaching", "Workshop", "Online Event", "Offline Event", "Hybrid Program"];
const defaultFacilitators = ["Dr Luv Patel", "Amit Verma", "Neha Kapoor", "Arjun Sharma"];
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function recordsFromNames(names: string[]) {
  return names.map((name) => ({ id: generateId(), name }));
}

function readRecords(key: string, defaults: string[]) {
  try {
    const parsed = readLocalArray<MasterRecord>(key);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter((item) => item.name?.trim());
  } catch {
    return recordsFromNames(defaults);
  }
  const seeded = recordsFromNames(defaults);
  window.localStorage.setItem(key, JSON.stringify(seeded));
  return seeded;
}

export default function WorkshopSetupPage() {
  const [workshopTypes, setWorkshopTypes] = useState<MasterRecord[]>([]);
  const [facilitators, setFacilitators] = useState<MasterRecord[]>([]);
  const [workshopTypeName, setWorkshopTypeName] = useState("");
  const [facilitatorName, setFacilitatorName] = useState("");
  const [editingWorkshopTypeId, setEditingWorkshopTypeId] = useState<string | null>(null);
  const [editingFacilitatorId, setEditingFacilitatorId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    function loadLocal() {
      setWorkshopTypes(readRecords(WORKSHOP_TYPES_STORAGE_KEY, defaultWorkshopTypes));
      setFacilitators(readRecords(FACILITATORS_STORAGE_KEY, defaultFacilitators));
    }

    loadLocal();
    hydrateLiveState().then(loadLocal);
  }, []);

  const filteredWorkshopTypes = useMemo(() => filterRecords(workshopTypes, search), [search, workshopTypes]);
  const filteredFacilitators = useMemo(() => filterRecords(facilitators, search), [facilitators, search]);

  function saveWorkshopTypes(next: MasterRecord[]) {
    setWorkshopTypes(next);
    void saveLiveState({ workshopTypes: next });
  }

  function saveFacilitators(next: MasterRecord[]) {
    setFacilitators(next);
    void saveLiveState({ facilitators: next });
  }

  function saveMaster(kind: MasterKind, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isWorkshopType = kind === "workshopType";
    const name = (isWorkshopType ? workshopTypeName : facilitatorName).trim();
    const records = isWorkshopType ? workshopTypes : facilitators;
    const editingId = isWorkshopType ? editingWorkshopTypeId : editingFacilitatorId;
    const saveRecords = isWorkshopType ? saveWorkshopTypes : saveFacilitators;

    if (!name) {
      setMessage(`Please enter ${isWorkshopType ? "workshop type" : "facilitator"} name.`);
      return;
    }

    const duplicate = records.some((record) => record.name.toLowerCase() === name.toLowerCase() && record.id !== editingId);
    if (duplicate) {
      setMessage(`${name} already exists.`);
      return;
    }

    if (editingId) {
      saveRecords(records.map((record) => record.id === editingId ? { ...record, name } : record));
      setMessage(`${name} updated successfully.`);
    } else {
      saveRecords([{ id: generateId(), name }, ...records]);
      setMessage(`${name} added successfully.`);
    }

    if (isWorkshopType) {
      setWorkshopTypeName("");
      setEditingWorkshopTypeId(null);
    } else {
      setFacilitatorName("");
      setEditingFacilitatorId(null);
    }
  }

  function editRecord(kind: MasterKind, record: MasterRecord) {
    if (kind === "workshopType") {
      setWorkshopTypeName(record.name);
      setEditingWorkshopTypeId(record.id);
    } else {
      setFacilitatorName(record.name);
      setEditingFacilitatorId(record.id);
    }
    setMessage(`Editing ${record.name}.`);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  function deleteRecord(kind: MasterKind, id: string) {
    if (kind === "workshopType") {
      saveWorkshopTypes(workshopTypes.filter((record) => record.id !== id));
      if (editingWorkshopTypeId === id) {
        setWorkshopTypeName("");
        setEditingWorkshopTypeId(null);
      }
      setMessage("Workshop type deleted.");
      return;
    }

    saveFacilitators(facilitators.filter((record) => record.id !== id));
    if (editingFacilitatorId === id) {
      setFacilitatorName("");
      setEditingFacilitatorId(null);
    }
    setMessage("Facilitator deleted.");
  }

  function clearForm(kind: MasterKind) {
    if (kind === "workshopType") {
      setWorkshopTypeName("");
      setEditingWorkshopTypeId(null);
    } else {
      setFacilitatorName("");
      setEditingFacilitatorId(null);
    }
    setMessage("");
  }

  return (
    <AdminPlatformShell activeLabel="Workshop Setup" description="Create and maintain workshop type and facilitator master lists used across workshop setup screens." title="Workshop Type & Facilitator">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={<Workflow className="size-5 text-indigo-600" />} label="Workshop Types" value={workshopTypes.length} />
        <Metric icon={<UserRound className="size-5 text-emerald-600" />} label="Facilitators" value={facilitators.length} />
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lists..."
              value={search}
            />
          </label>
        </div>
      </div>

      {message ? (
        <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${message.includes("Please") || message.includes("already") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          <Check className="size-4" />
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <MasterPanel
          editing={Boolean(editingWorkshopTypeId)}
          icon={<Workflow className="size-5" />}
          kind="workshopType"
          name={workshopTypeName}
          onClear={() => clearForm("workshopType")}
          onDelete={(id) => deleteRecord("workshopType", id)}
          onEdit={(record) => editRecord("workshopType", record)}
          onNameChange={setWorkshopTypeName}
          onSubmit={(event) => saveMaster("workshopType", event)}
          records={filteredWorkshopTypes}
          title="Workshop Type"
        />
        <MasterPanel
          editing={Boolean(editingFacilitatorId)}
          icon={<UserRound className="size-5" />}
          kind="facilitator"
          name={facilitatorName}
          onClear={() => clearForm("facilitator")}
          onDelete={(id) => deleteRecord("facilitator", id)}
          onEdit={(record) => editRecord("facilitator", record)}
          onNameChange={setFacilitatorName}
          onSubmit={(event) => saveMaster("facilitator", event)}
          records={filteredFacilitators}
          title="Facilitator"
        />
      </div>
    </AdminPlatformShell>
  );
}

function filterRecords(records: MasterRecord[], search: string) {
  const value = search.trim().toLowerCase();
  if (!value) return records;
  return records.filter((record) => record.name.toLowerCase().includes(value));
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {icon}
      <p className="mt-4 text-3xl font-black text-slate-950">{value}</p>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function MasterPanel({
  editing,
  icon,
  kind,
  name,
  onClear,
  onDelete,
  onEdit,
  onNameChange,
  onSubmit,
  records,
  title
}: {
  editing: boolean;
  icon: ReactNode;
  kind: MasterKind;
  name: string;
  onClear: () => void;
  onDelete: (id: string) => void;
  onEdit: (record: MasterRecord) => void;
  onNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  records: MasterRecord[];
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">{kind === "workshopType" ? "Workshop Master" : "Team Master"}</p>
          <h3 className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-950">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">{icon}</span>
            {title}
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{records.length} saved</span>
      </div>

      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-600">{title} Name</span>
          <input className={inputClass} onChange={(event) => onNameChange(event.target.value)} placeholder={`Enter ${title.toLowerCase()} name`} value={name} />
        </label>
        <button className="inline-flex min-h-[48px] items-center justify-center gap-2 self-end rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700" type="submit">
          <Plus className="size-4" />
          {editing ? "Update" : "Add"}
        </button>
        <button className="inline-flex min-h-[48px] items-center justify-center gap-2 self-end rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={onClear} type="button">
          <RefreshCw className="size-4" />
          Clear
        </button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[520px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">{title}</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length ? records.map((record) => (
              <tr className="hover:bg-indigo-50/40" key={record.id}>
                <td className="px-4 py-4 font-black text-slate-950">{record.name}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <button className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => onEdit(record)} title="Edit" type="button">
                      <Edit3 className="size-4" />
                    </button>
                    <button className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => onDelete(record.id)} title="Delete" type="button">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={2}>No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
