"use client";

import {
  BadgePercent,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  FileText,
  Home,
  Menu,
  Settings,
  Table2,
  UserRound,
  UsersRound,
  Wallet,
  Workflow,
  type LucideIcon
} from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

type DiscountType = "percent" | "flat";

const masterItems = [
  "Location",
  "Tables",
  "Sales Person",
  "Workshop Master",
  "Workshop Schedule",
  "Workshop Referral",
  "Resources",
  "Workshop Discount",
  "Client",
  "Family"
];

const events = ["Leadership Sprint", "Sales Masterclass", "Growth Bootcamp", "Founder Strategy Session"];
const facilitators = ["Facilitator A", "Facilitator B", "Facilitator C", "Facilitator D"];

export default function ManageEventSchedulePage() {
  const [showMasters, setShowMasters] = useState(true);
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

  const completion = useMemo(() => {
    const values = [
      selectedEvent,
      facilitator,
      batch,
      isPaidEvent ? feesWithTax : "free",
      discountValue,
      orderQtyTitle,
      minOrderQty,
      maxOrderQty
    ];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [batch, discountValue, facilitator, feesWithTax, isPaidEvent, maxOrderQty, minOrderQty, orderQtyTitle, selectedEvent]);

  function onClear() {
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
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    console.log({
      batch,
      discountCodeEod,
      discountDescription,
      discountType,
      discountValue,
      facilitator,
      feesWithTax,
      isPaidEvent,
      isPartPaymentAllow,
      maxOrderQty,
      minOrderQty,
      minimumPartPayment,
      orderQtyTitle,
      selectedEvent,
      transferLeadToCrm
    });
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100 disabled:text-gray-400";
  const labelClass = "mb-1.5 block text-sm font-medium text-gray-600";

  return (
    <main className="min-h-screen bg-gray-50 p-3 font-sans text-gray-900 md:p-5">
      <div className="mx-auto max-w-[1560px] space-y-4">
        <header className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button aria-label="Open menu" className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" type="button">
                <Menu className="h-5 w-5" />
              </button>
              <nav className="hidden flex-wrap items-center gap-1 md:flex">
                {[
                  { icon: Home, label: "Dashboard" },
                  { icon: Table2, label: "Masters", active: true },
                  { icon: UserRound, label: "Profile Analysis" },
                  { icon: Box, label: "Process" },
                  { icon: Workflow, label: "Lead" },
                  { icon: FileText, label: "Reports" },
                  { icon: Settings, label: "Settings" }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                        item.active ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
                      }`}
                      key={item.label}
                      onClick={() => item.label === "Masters" && setShowMasters((open) => !open)}
                      type="button"
                    >
                      <Icon className="size-4" />
                      {item.label}
                      {item.label === "Masters" ? <ChevronDown className="size-4" /> : null}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Welcome</p>
              <p className="text-sm font-semibold text-gray-900">Admin</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <aside className={`${showMasters ? "block" : "hidden"} rounded-lg border border-gray-200 bg-white p-3 shadow-sm`}>
            <div className="mb-3 rounded-md bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-indigo-600">Masters</p>
              <p className="text-sm font-semibold text-gray-900">Workshop Schedule</p>
            </div>
            <div className="space-y-1">
              {masterItems.map((item) => {
                const href =
                  item === "Workshop Master"
                    ? "/workshop-master"
                    : item === "Workshop Schedule"
                      ? "/workshop-scheduling-admin"
                      : item === "Client"
                        ? "/manage-client"
                        : undefined;
                const className = `flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                  item === "Workshop Schedule" ? "bg-indigo-50 font-semibold text-indigo-700" : "text-gray-700 hover:bg-gray-50"
                }`;

                if (href) {
                  return (
                    <a className={className} href={href} key={item}>
                      <span>{item}</span>
                      <ChevronDown className="-rotate-90 size-4 text-gray-400" />
                    </a>
                  );
                }

                return (
                  <button className={className} key={item} type="button">
                    <span>{item}</span>
                    <ChevronDown className="-rotate-90 size-4 text-gray-400" />
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Workshop Schedule</p>
                  <h1 className="mt-1 text-2xl font-semibold text-gray-950">Manage Event Schedule</h1>
                  <p className="mt-1 text-sm text-gray-500">Create schedule rules, pricing controls, discount limits, and CRM routing.</p>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-indigo-500 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                  type="button"
                >
                  <Eye className="h-4 w-4" />
                  View Data
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {[
                  { icon: CalendarDays, label: "Configured Events", value: "24", tone: "bg-indigo-50 text-indigo-700" },
                  { icon: UsersRound, label: "Open Seats", value: "1,840", tone: "bg-cyan-50 text-cyan-700" },
                  { icon: Wallet, label: "Paid Flow", value: isPaidEvent ? "Active" : "Free", tone: "bg-emerald-50 text-emerald-700" },
                  { icon: Clock3, label: "Form Progress", value: `${completion}%`, tone: "bg-amber-50 text-amber-700" }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div className="rounded-lg border border-gray-200 bg-white p-3" key={item.label}>
                      <div className="flex items-center gap-3">
                        <span className={`grid size-10 place-items-center rounded-full ${item.tone}`}>
                          <Icon className="size-5" />
                        </span>
                        <div>
                          <p className="text-lg font-bold leading-tight">{item.value}</p>
                          <p className="text-xs text-gray-500">{item.label}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form className="grid gap-4 xl:grid-cols-[1fr_320px]" onSubmit={onSave}>
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <SectionTitle icon={CalendarDays} title="Basic Setup" />
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                        <input
                          checked={transferLeadToCrm}
                          className="h-4 w-4 accent-indigo-600"
                          onChange={(e) => setTransferLeadToCrm(e.target.checked)}
                          type="checkbox"
                        />
                        Transfer Lead to CRM?
                      </label>
                      <label className={labelClass}>Select Event</label>
                      <select className={inputClass} onChange={(e) => setSelectedEvent(e.target.value)} value={selectedEvent}>
                        <option value="">Select Event</option>
                        {events.map((event) => (
                          <option key={event} value={event}>{event}</option>
                        ))}
                      </select>
                    </div>

                    <Field label="Facilitator">
                      <select className={inputClass} onChange={(e) => setFacilitator(e.target.value)} value={facilitator}>
                        <option value="">Select Facilitator</option>
                        {facilitators.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Batch">
                      <input className={inputClass} onChange={(e) => setBatch(e.target.value)} placeholder="Batch name" value={batch} />
                    </Field>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <SectionTitle icon={Wallet} title="Pricing And Discount" />
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <label className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input checked={isPaidEvent} className="h-4 w-4 accent-indigo-600" onChange={(e) => setIsPaidEvent(e.target.checked)} type="checkbox" />
                        Is Paid Event?
                      </label>
                      <input
                        className={inputClass}
                        disabled={!isPaidEvent}
                        onChange={(e) => setFeesWithTax(e.target.value)}
                        placeholder="Fees With Tax"
                        value={feesWithTax}
                      />
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <label className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          checked={isPartPaymentAllow}
                          className="h-4 w-4 accent-indigo-600"
                          onChange={(e) => setIsPartPaymentAllow(e.target.checked)}
                          type="checkbox"
                        />
                        Is Part Payment Allow?
                      </label>
                      <input
                        className={inputClass}
                        disabled={!isPartPaymentAllow}
                        onChange={(e) => setMinimumPartPayment(e.target.value)}
                        placeholder="Minimum Part Payment"
                        value={minimumPartPayment}
                      />
                    </div>

                    <Field label="Discount Code/EOD">
                      <input className={inputClass} onChange={(e) => setDiscountCodeEod(e.target.value)} placeholder="DISCOUNT10" value={discountCodeEod} />
                    </Field>

                    <div>
                      <label className={labelClass}>Discount Type</label>
                      <div className="flex min-h-[42px] items-center gap-4 rounded-md border border-gray-300 px-3 text-sm text-gray-700">
                        <label className="inline-flex items-center gap-2">
                          <input checked={discountType === "percent"} className="accent-indigo-600" onChange={() => setDiscountType("percent")} type="radio" />
                          %
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input checked={discountType === "flat"} className="accent-indigo-600" onChange={() => setDiscountType("flat")} type="radio" />
                          Flat Amount
                        </label>
                      </div>
                    </div>

                    <Field label="Discount Value">
                      <input className={inputClass} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" type="number" value={discountValue} />
                    </Field>

                    <div className="md:col-span-2 xl:col-span-3">
                      <Field label="Discount Description">
                        <input className={inputClass} onChange={(e) => setDiscountDescription(e.target.value)} placeholder="Short note for this offer" value={discountDescription} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <SectionTitle icon={BadgePercent} title="Order Quantity Limits" />
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field label="Order Qty Title">
                      <input className={inputClass} onChange={(e) => setOrderQtyTitle(e.target.value)} placeholder="Seats" value={orderQtyTitle} />
                    </Field>
                    <Field label="Min Order Qty">
                      <input className={inputClass} onChange={(e) => setMinOrderQty(e.target.value)} placeholder="1" type="number" value={minOrderQty} />
                    </Field>
                    <Field label="Max Order Qty">
                      <input className={inputClass} onChange={(e) => setMaxOrderQty(e.target.value)} placeholder="10" type="number" value={maxOrderQty} />
                    </Field>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <SectionTitle icon={CheckCircle2} title="Schedule Preview" />
                  <dl className="mt-4 space-y-3 text-sm">
                    <PreviewRow label="Event" value={selectedEvent || "Not selected"} />
                    <PreviewRow label="Facilitator" value={facilitator || "Not selected"} />
                    <PreviewRow label="Batch" value={batch || "Not added"} />
                    <PreviewRow label="Payment" value={isPaidEvent ? `Paid ${feesWithTax || ""}` : "Free"} />
                    <PreviewRow label="Discount" value={`${discountType === "percent" ? "%" : "Flat"} ${discountValue || "0"}`} />
                  </dl>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">Actions</p>
                  <div className="mt-3 grid gap-2">
                    <button className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700" type="submit">
                      Save
                    </button>
                    <button className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50" onClick={onClear} type="button">
                      Clear
                    </button>
                  </div>
                </div>
              </aside>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-full bg-indigo-50 text-indigo-700">
        <Icon className="size-4" />
      </span>
      <h2 className="text-base font-semibold text-gray-950">{title}</h2>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}
