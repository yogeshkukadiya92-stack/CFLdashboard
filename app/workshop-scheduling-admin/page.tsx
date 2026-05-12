"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { BadgePercent, CalendarDays, CheckCircle2, Eye, RefreshCw, Save, Wallet } from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

type DiscountType = "percent" | "flat";

const events: string[] = [];
const facilitators: string[] = [];
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400";

export default function ManageEventSchedulePage() {
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

  const completion = useMemo(() => {
    const values = [selectedEvent, facilitator, batch, isPaidEvent ? feesWithTax : "free", discountValue, orderQtyTitle, minOrderQty, maxOrderQty];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [batch, discountValue, facilitator, feesWithTax, isPaidEvent, maxOrderQty, minOrderQty, orderQtyTitle, selectedEvent]);

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
    setSaved(true);
  }

  return (
    <AdminPlatformShell activeLabel="Workshop Schedule" description="Create schedule rules, pricing, discounts, limits and CRM routing without leaving the platform." title="Manage Event Schedule">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={CalendarDays} label="Configured Events" value="24" />
        <Metric icon={BadgePercent} label="Open Seats" value="1,840" />
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
                <SelectBox label="Select Event" onChange={setSelectedEvent} options={events} value={selectedEvent} />
              </div>
              <SelectBox label="Facilitator" onChange={setFacilitator} options={facilitators} value={facilitator} />
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
              <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-300 px-5 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50" type="button"><Eye className="size-4" />View Data</button>
            </div>
          </Panel>
        </aside>
      </form>
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
