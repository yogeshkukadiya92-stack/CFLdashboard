"use client";

import { HelpCircle, Eye, Menu } from "lucide-react";
import { useMemo, useState } from "react";

type FieldItem = {
  key: string;
  label: string;
  tooltip: string;
  defaultChecked?: boolean;
};

const fieldConfig: FieldItem[] = [
  { key: "firstName", label: "First Name", tooltip: "User નું પ્રથમ નામ ફરજિયાત રાખો.", defaultChecked: true },
  { key: "lastName", label: "Last Name", tooltip: "User નું છેલ્લું નામ ફરજિયાત રાખો.", defaultChecked: true },
  { key: "mobile", label: "Mobile", tooltip: "OTP / સંપર્ક માટે મોબાઇલ નંબર.", defaultChecked: true },
  { key: "email", label: "Email", tooltip: "Email confirmations માટે.", defaultChecked: true },
  { key: "country", label: "Country", tooltip: "Country capture માટે.", defaultChecked: true },
  { key: "state", label: "State", tooltip: "State-based filtering/reporting માટે." },
  { key: "city", label: "City", tooltip: "City segmentation માટે." },
  { key: "address", label: "Address", tooltip: "પૂર્ણ સરનામું માંગવું હોય તો enable કરો." },
  { key: "age", label: "Age", tooltip: "Age analysis માટે." },
  { key: "gender", label: "Gender", tooltip: "Gender-wise analytics માટે." },
  { key: "occupation", label: "Occupation", tooltip: "Profession insights માટે." },
  { key: "firstTime", label: "First Time", tooltip: "નવી/પહેલી વાર join કરનાર ઓળખવા." },
  { key: "source", label: "Lead Source", tooltip: "Lead ક્યાંથી આવ્યો તે capture કરવા." },
  { key: "company", label: "Company", tooltip: "Corporate users માટે useful field." },
  { key: "referral", label: "Referral", tooltip: "કોણે refer કર્યું તે track કરવા." },
  { key: "notes", label: "Notes", tooltip: "Extra context માટે optional field." },
];

export default function ManageEventMasterPage() {
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [productGroup, setProductGroup] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  const [fieldState, setFieldState] = useState<Record<string, boolean>>(
    () =>
      fieldConfig.reduce<Record<string, boolean>>((acc, item) => {
        acc[item.key] = Boolean(item.defaultChecked);
        return acc;
      }, {})
  );

  const checkedCount = useMemo(
    () => Object.values(fieldState).filter(Boolean).length,
    [fieldState]
  );

  const toggleField = (key: string) => {
    setFieldState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearForm = () => {
    setEventName("");
    setEventType("");
    setFacilitator("");
    setProductGroup("");
    setIsPaid(false);
    setFieldState(
      fieldConfig.reduce<Record<string, boolean>>((acc, item) => {
        acc[item.key] = Boolean(item.defaultChecked);
        return acc;
      }, {})
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) {
      alert("Event/Product Name required");
      return;
    }

    console.log({
      eventName,
      eventType,
      facilitator,
      productGroup,
      isPaid,
      fields: fieldState,
    });
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans">
      <header className="mx-auto mb-4 flex max-w-7xl items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
          aria-label="Toggle Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="text-sm font-medium text-gray-700">Welcome Admin</p>
      </header>

      <section className="mx-auto max-w-7xl rounded-lg bg-white p-5 shadow-sm md:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-800">Manage Event Master</h1>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <Eye className="h-4 w-4" />
            View Data
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="eventName" className="mb-1 block text-sm text-gray-600">
              Event/Product Name
            </label>
            <input
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Enter event or product name"
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="eventType" className="mb-1 block text-sm text-gray-600">
                Select Event Type
              </label>
              <select
                id="eventType"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Choose type</option>
                <option value="Workshop">Workshop</option>
                <option value="Event">Event</option>
                <option value="Product">Product</option>
              </select>
            </div>

            <div>
              <label htmlFor="facilitator" className="mb-1 block text-sm text-gray-600">
                Select Default Facilitator
              </label>
              <select
                id="facilitator"
                value={facilitator}
                onChange={(e) => setFacilitator(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Choose facilitator</option>
                <option>Dr Luv Patel</option>
                <option>Arjun Sharma</option>
                <option>Neha Kapoor</option>
              </select>
            </div>

            <div>
              <label htmlFor="productGroup" className="mb-1 block text-sm text-gray-600">
                Select Product Group
              </label>
              <select
                id="productGroup"
                value={productGroup}
                onChange={(e) => setProductGroup(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Choose group</option>
                <option>Leadership</option>
                <option>Sales</option>
                <option>Coaching</option>
              </select>
            </div>

            <label className="mt-6 inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              Is Paid?
            </label>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <p className="text-sm font-medium text-gray-600">
              Default Setting For Event ({checkedCount}/16)
            </p>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {fieldConfig.map((field) => (
              <div
                key={field.key}
                className="group relative flex items-center justify-between rounded-md border border-gray-200 px-3 py-3"
              >
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={fieldState[field.key]}
                    onChange={() => toggleField(field.key)}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  {field.label}
                </label>

                <div className="relative ml-2">
                  <HelpCircle className="h-4 w-4 cursor-help text-gray-400" />
                  <div className="invisible absolute right-0 top-6 z-10 w-48 rounded-md bg-gray-900 px-2 py-1.5 text-xs text-white opacity-0 shadow transition-all group-hover:visible group-hover:opacity-100">
                    {field.tooltip}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600"
            >
              Save
            </button>
            <button
              type="button"
              onClick={clearForm}
              className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

