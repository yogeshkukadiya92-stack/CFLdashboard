"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { BadgePercent, CalendarDays, CheckCircle2, Eye, RefreshCw, Save, Wallet } from "lucide-react";
import { hydrateLiveState, readLocalArray, saveLiveState } from "@/lib/live-state";
import { generateId } from "@/lib/utils";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

type DiscountType = "percent" | "flat";
type WorkshopRecord = {
  facilitator: string;
  id: string;
  isPaid: boolean;
  name: string;
  productGroup: string;
  type: string;
};
type ScheduleRecord = {
  batch: string;
  discountType: DiscountType;
  discountValue: string;
  facilitator: string;
  feesWithTax: string;
  id: string;
  isPaidEvent: boolean;
  isPartPaymentAllow: boolean;
  maxOrderQty: string;
  minOrderQty: string;
  minimumPartPayment: string;
  orderQtyTitle: string;
  selectedEvent: string;
  transferLeadToCrm: boolean;
};

const WORKSHOP_STORAGE_KEY = "cfl_workshop_master_records_v1";
const FACILITATORS_STORAGE_KEY = "cfl_facilitators_v1";
const SCHEDULE_STORAGE_KEY = "cfl_event_schedules_v1";
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400";

export default function ManageEventSchedulePage() {
  const [workshops, setWorkshops] = useState<WorkshopRecord[]>([]);
  const [facilitatorMasters, setFacilitatorMasters] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [showData, setShowData] = useState(false);
  const [transferLeadToCrm, setTransferLeadToCrm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [batch, setBatch] = useState("");
  const [isPaidEvent, setIsPaidEvent] = useState(false);
  const [feesWithTax, setFeesWithTax] = useState("");
  const [isPartPaymentAllow, setIsPartPaymentAllow] = useState(false);
  const [minimumPartPayment, setMinimumPartPayment] = useState("");
  const [discountCodeEod, setDiscountCodeEod] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountDescription, setDiscountDescription] = useState("");
  const [orderQtyTitle, setOrderQtyTitle] = useState("");
  const [minOrderQty, setMinOrderQty] = useState("");
  const [maxOrderQty, setMaxOrderQty] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    function loadLocal() {
      setWorkshops(readLocalArray<WorkshopRecord>(WORKSHOP_STORAGE_KEY));
      setFacilitatorMasters(readMasterNames(FACILITATORS_STORAGE_KEY));
      setSchedules(readLocalArray<ScheduleRecord>(SCHEDULE_STORAGE_KEY));
    }

    loadLocal();
    hydrateLiveState().then(loadLocal);
  }, []);

  const completion = useMemo(() => {
    const values = [selectedEvent, facilitator, batch, isPaidEvent ? feesWithTax : "free", discountValue, orderQtyTitle, minOrderQty, maxOrderQty];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [batch, discountValue, facilitator, feesWithTax, isPaidEvent, maxOrderQty, minOrderQty, orderQtyTitle, selectedEvent]);
  const eventOptions = workshops.map((workshop) => workshop.name);
  const facilitatorOptions = Array.from(new Set([...facilitatorMasters, ...workshops.map((workshop) => workshop.facilitator)].filter(Boolean)));

  function clear() {
    setTransferLeadToCrm(false);
    setSelectedEvent("");
    setFacilitator("");
    setBatch("");
    setIsPaidEvent(false);
    setFeesWithTax("");
    setIsPartPaymentAllow(false);
    setMinimumPartPayment("");
    setDiscountCodeEod("");
    setDiscountType("percent");
    setDiscountValue("");
    setDiscountDescription("");
    setOrderQtyTitle("");
    setMinOrderQty("");
    setMaxOrderQty("");
    setSaved(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: ScheduleRecord = {
      batch: batch.trim() || "Main Batch",
      discountType,
      discountValue,
      facilitator,
      feesWithTax,
      id: generateId(),
      isPaidEvent,
      isPartPaymentAllow,
      maxOrderQty,
      minOrderQty,
      minimumPartPayment,
      orderQtyTitle,
      selectedEvent,
      transferLeadToCrm
    };
    const next = [payload, ...schedules];
    setSchedules(next);
    void saveLiveState({ schedules: next });
    setSaved(true);
    setShowData(true);
  }

  return (
    <AdminPlatformShell activeLabel="Workshop Schedule" description="Create schedule rules, pricing, discounts, limits and CRM routing without leaving the platform." title="Manage Event Schedule">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={CalendarDays} label="Configured Events" value={String(schedules.length)} />
        <Metric icon={BadgePercent} label="Workshop Masters" value={String(workshops.length)} />
        <Metric icon={Wallet} label="Payment Flow" value={isPaidEvent ? "Paid" : "Free"} />
        <Metric icon={CheckCircle2} label="Form Progress" value={`${completion}%`} />
      </div>

      <form className="grid gap-4 xl:grid-cols-[1fr_320px]" onSubmit={submit}>
        <div className="space-y-4">
          <Panel title="Basic Setup">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-600">
                  <input checked={transferLeadToCrm} className="size-4 accent-indigo-600" onChange={(event) => setTransferLeadToCrm(event.target.checked)} type="checkbox" />
                  Transfer Lead to CRM?
                </label>
                <SelectBox label="Select Event" onChange={setSelectedEvent} options={eventOptions} value={selectedEvent} />
              </div>
              <SelectBox label="Facilitator" onChange={setFacilitator} options={facilitatorOptions} value={facilitator} />
              <Field label="Batch"><input className={inputClass} onChange={(event) => setBatch(event.target.value)} placeholder="Batch name" value={batch} /></Field>
            </div>
          </Panel>

          <Panel title="Pricing And Discount">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <label className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input checked={isPaidEvent} className="size-4 accent-indigo-600" onChange={(event) => setIsPaidEvent(event.target.checked)} type="checkbox" />
                  Is Paid Event?
                </label>
                <input className={inputClass} disabled={!isPaidEvent} onChange={(event) => setFeesWithTax(event.target.value)} placeholder="Fees With Tax" value={feesWithTax} />
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <label className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input checked={isPartPaymentAllow} className="size-4 accent-indigo-600" onChange={(event) => setIsPartPaymentAllow(event.target.checked)} type="checkbox" />
                  Is Part Payment Allow?
                </label>
                <input className={inputClass} disabled={!isPartPaymentAllow} onChange={(event) => setMinimumPartPayment(event.target.value)} placeholder="Minimum Part Payment" value={minimumPartPayment} />
              </div>
              <Field label="Discount Code/EOD"><input className={inputClass} onChange={(event) => setDiscountCodeEod(event.target.value)} placeholder="DISCOUNT10" value={discountCodeEod} /></Field>
              <div>
                <span className="mb-2 block text-sm font-bold text-slate-600">Discount Type</span>
                <div className="flex min-h-[48px] items-center gap-4 rounded-xl border border-slate-200 px-4 text-sm font-bold">
                  <label className="inline-flex items-center gap-2"><input checked={discountType === "percent"} className="accent-indigo-600" onChange={() => setDiscountType("percent")} type="radio" />%</label>
                  <label className="inline-flex items-center gap-2"><input checked={discountType === "flat"} className="accent-indigo-600" onChange={() => setDiscountType("flat")} type="radio" />Flat Amount</label>
                </div>
              </div>
              <Field label="Discount Value"><input className={inputClass} onChange={(event) => setDiscountValue(event.target.value)} placeholder="0" type="number" value={discountValue} /></Field>
              <div className="md:col-span-2 xl:col-span-3"><Field label="Discount Description"><input className={inputClass} onChange={(event) => setDiscountDescription(event.target.value)} placeholder="Short note for offer" value={discountDescription} /></Field></div>
            </div>
          </Panel>

          <Panel title="Order Quantity Limits">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Order Qty Title"><input className={inputClass} onChange={(event) => setOrderQtyTitle(event.target.value)} placeholder="Seats" value={orderQtyTitle} /></Field>
              <Field label="Min Order Qty"><input className={inputClass} onChange={(event) => setMinOrderQty(event.target.value)} placeholder="1" type="number" value={minOrderQty} /></Field>
              <Field label="Max Order Qty"><input className={inputClass} onChange={(event) => setMaxOrderQty(event.target.value)} placeholder="10" type="number" value={maxOrderQty} /></Field>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Schedule Preview">
            <Preview label="Event" value={selectedEvent || "Not selected"} />
            <Preview label="Facilitator" value={facilitator || "Not selected"} />
            <Preview label="Batch" value={batch || "Not added"} />
            <Preview label="Payment" value={isPaidEvent ? `Paid ${feesWithTax || ""}` : "Free"} />
            <Preview label="Discount" value={`${discountType === "percent" ? "%" : "Flat"} ${discountValue || "0"}`} />
          </Panel>
          <Panel title="Actions">
            {saved ? <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">Schedule saved.</p> : null}
            <div className="grid gap-2">
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700" type="submit"><Save className="size-4" />Save</button>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={clear} type="button"><RefreshCw className="size-4" />Clear</button>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-300 px-5 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50" onClick={() => setShowData((value) => !value)} type="button"><Eye className="size-4" />{showData ? "Hide Data" : "View Data"}</button>
            </div>
          </Panel>
        </aside>
      </form>

      {showData ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-black text-slate-950">Saved Event Schedules</h3>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {["Event", "Batch", "Facilitator", "Payment", "Discount", "CRM", "Action"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.length ? schedules.map((row) => (
                  <tr className="hover:bg-emerald-50/40" key={row.id}>
                    <td className="px-4 py-4 font-black text-slate-950">{row.selectedEvent}</td>
                    <td className="px-4 py-4">{row.batch}</td>
                    <td className="px-4 py-4">{row.facilitator}</td>
                    <td className="px-4 py-4">{row.isPaidEvent ? `Paid ${row.feesWithTax || ""}` : "Free"}</td>
                    <td className="px-4 py-4">{row.discountType === "percent" ? `${row.discountValue || 0}%` : `INR ${row.discountValue || 0}`}</td>
                    <td className="px-4 py-4">{row.transferLeadToCrm ? "Yes" : "No"}</td>
                    <td className="px-4 py-4">
                      <button
                        className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
                        onClick={() => {
                          const next = schedules.filter((item) => item.id !== row.id);
                          setSchedules(next);
                          void saveLiveState({ schedules: next });
                        }}
                        type="button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No schedules saved yet. Create a workshop in Workshop Master, then save a schedule here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AdminPlatformShell>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="size-5 text-indigo-600" /><p className="mt-4 text-2xl font-black">{value}</p><p className="text-sm font-semibold text-slate-500">{label}</p></div>;
}
function Panel({ children, title }: { children: ReactNode; title: string }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-black text-slate-950">{title}</h3>{children}</section>;
}
function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>{children}</label>;
}
function SelectBox({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return <Field label={label}><select className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}><option value="">Select {label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>;
}
function Preview({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0"><span className="text-slate-500">{label}</span><span className="text-right font-bold text-slate-900">{value}</span></div>;
}
function readMasterNames(key: string) {
  try {
    const records = readLocalArray<{ name?: string }>(key);
    return records.map((record) => record.name?.trim()).filter(Boolean) as string[];
  } catch {
    return [];
  }
}
