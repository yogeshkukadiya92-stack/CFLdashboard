"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { Check, Edit3, Eye, RefreshCw, Save, Trash2, UserPlus } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

type CommissionRow = {
  id: string;
  workshop: string;
  leadPercent: string;
  directPercent: string;
};
type SalesPersonRecord = {
  canViewOther: boolean;
  commissions: CommissionRow[];
  email: string;
  group: string;
  id: string;
  isActive: boolean;
  mobile: string;
  name: string;
};
type WorkshopRecord = {
  name: string;
};

const groups = ["Business", "Health", "Other"];
const WORKSHOP_STORAGE_KEY = "cfl_workshop_master_records_v1";
const SALES_STORAGE_KEY = "cfl_sales_people_v1";
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export default function SalesPersonPage() {
  const [workshops, setWorkshops] = useState<string[]>([]);
  const [records, setRecords] = useState<SalesPersonRecord[]>([]);
  const [showData, setShowData] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [group, setGroup] = useState("");
  const [canViewOther, setCanViewOther] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [generalAssign, setGeneralAssign] = useState("");
  const [directClient, setDirectClient] = useState("");
  const [commissionWorkshop, setCommissionWorkshop] = useState("");
  const [leadPercent, setLeadPercent] = useState("15");
  const [directPercent, setDirectPercent] = useState("5");
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const fullName = useMemo(() => [firstName, middleName, lastName].filter(Boolean).join(" ") || "New sales person", [firstName, lastName, middleName]);

  useEffect(() => {
    try {
      const workshopRecords = JSON.parse(window.localStorage.getItem(WORKSHOP_STORAGE_KEY) || "[]") as WorkshopRecord[];
      setWorkshops(workshopRecords.map((item) => item.name).filter(Boolean));
      setRecords(JSON.parse(window.localStorage.getItem(SALES_STORAGE_KEY) || "[]") as SalesPersonRecord[]);
    } catch {
      setWorkshops([]);
      setRecords([]);
    }
  }, []);

  function saveRecords(next: SalesPersonRecord[]) {
    setRecords(next);
    window.localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(next));
  }

  function clearForm() {
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setMobile("");
    setPassword("");
    setEmail("");
    setGroup("");
    setCanViewOther(true);
    setIsActive(true);
    setGeneralAssign("");
    setDirectClient("");
    setCommissionWorkshop("");
    setLeadPercent("15");
    setDirectPercent("5");
    setCommissions([]);
    setEditingId(null);
    setError("");
    setSaved(false);
  }

  function addCommission() {
    if (!commissionWorkshop || !leadPercent || !directPercent) {
      setError("Please select workshop and commission percentages.");
      return;
    }

    if (editingId) {
      setCommissions((rows) =>
        rows.map((row) =>
          row.id === editingId ? { ...row, workshop: commissionWorkshop, leadPercent, directPercent } : row
        )
      );
      setEditingId(null);
    } else {
      setCommissions((rows) => [
        ...rows,
        { id: crypto.randomUUID(), workshop: commissionWorkshop, leadPercent, directPercent }
      ]);
    }

    setCommissionWorkshop("");
    setLeadPercent("15");
    setDirectPercent("5");
    setError("");
  }

  function editCommission(row: CommissionRow) {
    setEditingId(row.id);
    setCommissionWorkshop(row.workshop);
    setLeadPercent(row.leadPercent);
    setDirectPercent(row.directPercent);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    if (!firstName || !lastName || !mobile || !password || !email || !group) {
      setError("Please fill all required salesperson fields.");
      return;
    }
    setError("");
    saveRecords([
      {
        canViewOther,
        commissions,
        email,
        group,
        id: crypto.randomUUID(),
        isActive,
        mobile,
        name: fullName
      },
      ...records
    ]);
    setSaved(true);
    setShowData(true);
  }

  return (
    <AdminPlatformShell activeLabel="Sales Person" description="Create salesperson profiles, permissions and workshop-wise commission rules inside the CRM platform." title="Manage Sales Person">
      <form className="space-y-4" onSubmit={submit}>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-500">CRM User Profile</p>
              <h3 className="mt-1 text-2xl font-black text-slate-950">{fullName}</h3>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50"
              onClick={() => setShowData((value) => !value)}
              type="button"
            >
              <Eye className="size-4" />
              {showData ? "Hide Data" : "View Data"}
            </button>
          </div>

          {error ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
          {saved ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">Sales person saved successfully.</p> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Field label="First Name *"><input className={inputClass} onChange={(event) => setFirstName(event.target.value)} placeholder="First Name" value={firstName} /></Field>
            <Field label="Middle Name"><input className={inputClass} onChange={(event) => setMiddleName(event.target.value)} placeholder="Middle Name" value={middleName} /></Field>
            <Field label="Last Name *"><input className={inputClass} onChange={(event) => setLastName(event.target.value)} placeholder="Last Name" value={lastName} /></Field>
            <Field label="Mobile No [Login ID] *"><input className={inputClass} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile No" value={mobile} /></Field>
            <Field label="Password *"><input className={inputClass} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} /></Field>
            <Field label="Email Id *"><input className={inputClass} onChange={(event) => setEmail(event.target.value)} placeholder="Email Id" type="email" value={email} /></Field>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Field label="Sales Person Group *">
              <select className={inputClass} onChange={(event) => setGroup(event.target.value)} value={group}>
                <option value="">Select Sales Person Group</option>
                {groups.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <label className="flex min-h-[74px] items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
              <input checked={canViewOther} className="size-5 accent-indigo-600" onChange={(event) => setCanViewOther(event.target.checked)} type="checkbox" />
              Can View Client Other Workshop Reg.?
            </label>
            <label className="flex min-h-[74px] items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
              <input checked={isActive} className="size-5 accent-indigo-600" onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
              Is Active?
            </label>
          </div>

          <div className="mt-5 grid gap-4">
            <Field label="Select Workshop Conversation For General Lead Assign">
              <select className={inputClass} onChange={(event) => setGeneralAssign(event.target.value)} value={generalAssign}>
                <option value="">Select workshop conversations</option>
                {workshops.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Select Workshop Conversation For Direct Client">
              <select className={inputClass} onChange={(event) => setDirectClient(event.target.value)} value={directClient}>
                <option value="">Select direct client conversations</option>
                {workshops.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-xl font-black text-slate-950">Manage Workshop wise Commission & Commission [Direct Client]</h3>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px_220px_auto]">
            <Field label="Select WorkShop">
              <select className={inputClass} onChange={(event) => setCommissionWorkshop(event.target.value)} value={commissionWorkshop}>
                <option value="">Select Workshop</option>
                {workshops.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Commission Via Lead Assign (%)"><input className={inputClass} onChange={(event) => setLeadPercent(event.target.value)} type="number" value={leadPercent} /></Field>
            <Field label="Commission [Direct Client] (%)"><input className={inputClass} onChange={(event) => setDirectPercent(event.target.value)} type="number" value={directPercent} /></Field>
            <button className="mt-7 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700" onClick={addCommission} type="button">
              {editingId ? "Update Commission" : "Add Workshop Commission"}
            </button>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{["Workshop Name", "Commission Via Lead Assign (%)", "Commission [Direct Client] (%)", "Edit", "Delete"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissions.length ? commissions.map((row) => (
                  <tr className="hover:bg-indigo-50/40" key={row.id}>
                    <td className="px-4 py-4 font-bold">{row.workshop}</td>
                    <td className="px-4 py-4">{row.leadPercent}%</td>
                    <td className="px-4 py-4">{row.directPercent}%</td>
                    <td className="px-4 py-4"><button className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white" onClick={() => editCommission(row)} type="button"><Edit3 className="size-4" /></button></td>
                    <td className="px-4 py-4"><button className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600" onClick={() => setCommissions((rows) => rows.filter((item) => item.id !== row.id))} type="button"><Trash2 className="size-4" /></button></td>
                  </tr>
                )) : <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No Data Added</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {showData ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center gap-3">
              <UserPlus className="size-6 text-indigo-700" />
              <div>
                <p className="text-lg font-black text-slate-950">Saved Sales People</p>
                <p className="text-sm font-bold text-indigo-700">{records.length} records available for CRM assignment.</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[820px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>{["Name", "Mobile", "Email", "Group", "Status", "Commissions", "Action"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.length ? records.map((record) => (
                    <tr className="hover:bg-emerald-50/40" key={record.id}>
                      <td className="px-4 py-4 font-black text-slate-950">{record.name}</td>
                      <td className="px-4 py-4">{record.mobile}</td>
                      <td className="px-4 py-4">{record.email}</td>
                      <td className="px-4 py-4">{record.group}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${record.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{record.isActive ? "Active" : "Inactive"}</span>
                      </td>
                      <td className="px-4 py-4">{record.commissions.length}</td>
                      <td className="px-4 py-4">
                        <button className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-700" onClick={() => saveRecords(records.filter((item) => item.id !== record.id))} type="button">Delete</button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No salesperson records saved yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={clearForm} type="button">
            <RefreshCw className="size-4" />
            Clear
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700" type="submit">
            <Save className="size-4" />
            Save
          </button>
        </div>
      </form>
    </AdminPlatformShell>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
