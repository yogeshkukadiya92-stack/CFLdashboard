"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
  workshop: string;
  facilitator: string;
  batch: string;
  isPaidWorkshop: boolean;
  feesWithGst: number | "";
  isPartPaymentAllowed: boolean;
  minimumPartPayment: number | "";
  discountType: "percent" | "flat";
  discountValue: number | "";
  discountDescription: string;
  minOrderQty: number | "";
  maxOrderQty: number | "";
  startDate: string;
  endDate: string;
  lastRegistrationDate: string;
  venue: string;
  linkType: "WhatsApp" | "Telegram";
  crmCampaignName: string;
  crmMediaUrl: string;
  failedCampaignName: string;
  failedMediaUrl: string;
};

const sidebarLinks = ["Dashboard", "Workshops", "Reports", "Settings"];
const workshops = ["Leadership Sprint", "Sales Mastery", "Mindset Reset", "Business Acceleration Bootcamp"];
const facilitators = ["Dr Luv Patel", "Arjun Sharma", "Neha Kapoor", "Amit Verma"];
const venues = ["Surat", "Ahmedabad", "Mumbai", "Online Zoom"];

export default function WorkshopSchedulingAdminPage() {
  const [workshopDescription, setWorkshopDescription] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { handleSubmit, register, reset, watch } = useForm<FormValues>({
    defaultValues: {
      batch: "",
      crmCampaignName: "",
      crmMediaUrl: "",
      discountDescription: "",
      discountType: "flat",
      discountValue: "",
      endDate: "",
      failedCampaignName: "",
      failedMediaUrl: "",
      facilitator: "",
      feesWithGst: "",
      isPaidWorkshop: false,
      isPartPaymentAllowed: false,
      lastRegistrationDate: "",
      linkType: "WhatsApp",
      maxOrderQty: "",
      minOrderQty: "",
      minimumPartPayment: "",
      startDate: "",
      venue: "",
      workshop: ""
    }
  });

  const isPaidWorkshop = watch("isPaidWorkshop");
  const isPartPaymentAllowed = watch("isPartPaymentAllowed");
  const preview = useMemo(() => imagePreview, [imagePreview]);

  function onSubmit(data: FormValues) {
    console.log("Workshop Scheduling Form:", { ...data, emailBody, workshopDescription });
  }

  function onClear() {
    reset();
    setImagePreview(null);
    setWorkshopDescription("");
    setEmailBody("");
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500";
  const labelClass = "mb-1 block text-sm text-gray-600";

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-lg bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500">Admin Panel</p>
          <nav className="space-y-2">
            {sidebarLinks.map((item, index) => (
              <button
                className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                  index === 1 ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
                }`}
                key={item}
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="rounded-lg bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Workshop Scheduling &amp; Admin Management</h1>
            <button
              className="rounded-md border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
              type="button"
            >
              View Data
            </button>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <label className={labelClass} htmlFor="workshop">Select Workshop</label>
                <input className={inputClass} id="workshop" list="workshop-options" placeholder="Search workshop..." {...register("workshop")} />
                <datalist id="workshop-options">{workshops.map((w) => <option key={w} value={w} />)}</datalist>
              </div>
              <div>
                <label className={labelClass} htmlFor="facilitator">Facilitator</label>
                <input className={inputClass} id="facilitator" list="facilitator-options" placeholder="Search facilitator..." {...register("facilitator")} />
                <datalist id="facilitator-options">{facilitators.map((f) => <option key={f} value={f} />)}</datalist>
              </div>
              <div>
                <label className={labelClass} htmlFor="batch">Batch</label>
                <input className={inputClass} id="batch" placeholder="Enter batch" {...register("batch")} />
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input className="size-4 accent-indigo-600" type="checkbox" {...register("isPaidWorkshop")} />
                  Is Paid Workshop?
                </label>
                {isPaidWorkshop ? <input className={`${inputClass} mt-2`} placeholder="Fees (with GST)" type="number" {...register("feesWithGst", { valueAsNumber: true })} /> : null}
              </div>
              <div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input className="size-4 accent-indigo-600" type="checkbox" {...register("isPartPaymentAllowed")} />
                  Is Part Payment Allow?
                </label>
                {isPartPaymentAllowed ? <input className={`${inputClass} mt-2`} placeholder="Minimum Part Payment" type="number" {...register("minimumPartPayment", { valueAsNumber: true })} /> : null}
              </div>
              <div>
                <label className={labelClass}>Discount Type</label>
                <div className="flex items-center gap-4 rounded-md border border-gray-300 px-3 py-2">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="radio" value="percent" {...register("discountType")} />%</label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="radio" value="flat" {...register("discountType")} />Flat Amount</label>
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="discountValue">Discount Value</label>
                <input className={inputClass} id="discountValue" placeholder="Discount value" type="number" {...register("discountValue", { valueAsNumber: true })} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="discountDescription">Discount Description</label>
                <input className={inputClass} id="discountDescription" placeholder="Describe discount rule..." {...register("discountDescription")} />
              </div>

              <div>
                <label className={labelClass} htmlFor="minOrderQty">Min Order Qty</label>
                <input className={inputClass} id="minOrderQty" type="number" {...register("minOrderQty", { valueAsNumber: true })} />
              </div>
              <div>
                <label className={labelClass} htmlFor="maxOrderQty">Max Order Qty</label>
                <input className={inputClass} id="maxOrderQty" type="number" {...register("maxOrderQty", { valueAsNumber: true })} />
              </div>
              <div>
                <label className={labelClass} htmlFor="startDate">Start Date</label>
                <input className={inputClass} id="startDate" type="date" {...register("startDate")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="endDate">End Date</label>
                <input className={inputClass} id="endDate" type="date" {...register("endDate")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lastRegistrationDate">Last Registration Date</label>
                <input className={inputClass} id="lastRegistrationDate" type="date" {...register("lastRegistrationDate")} />
              </div>

              <div>
                <label className={labelClass} htmlFor="venue">Venue</label>
                <select className={inputClass} id="venue" {...register("venue")}>
                  <option value="">Select venue</option>
                  {venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="linkType">Link Type</label>
                <select className={inputClass} id="linkType" {...register("linkType")}>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Telegram">Telegram</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className={labelClass} htmlFor="workshopImage">Workshop Image (1024x576)</label>
                <input
                  accept="image/*"
                  className={inputClass}
                  id="workshopImage"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return setImagePreview(null);
                    const reader = new FileReader();
                    reader.onload = () => setImagePreview(String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                />
                {preview ? <img alt="Workshop preview" className="mt-3 h-40 w-full max-w-md rounded-md border border-gray-200 object-cover" src={preview} /> : null}
              </div>
            </div>

            <div>
              <h2 className="mb-2 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">Workshop Description</h2>
              <textarea
                className={`${inputClass} min-h-[180px]`}
                onChange={(event) => setWorkshopDescription(event.target.value)}
                placeholder="Write workshop description..."
                value={workshopDescription}
              />
            </div>

            <div>
              <h2 className="mb-4 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">Third Party API Setup</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div><label className={labelClass} htmlFor="crmCampaignName">CRM Campaign Name</label><input className={inputClass} id="crmCampaignName" placeholder="Campaign name" {...register("crmCampaignName")} /></div>
                <div><label className={labelClass} htmlFor="crmMediaUrl">CRM Media URL</label><input className={inputClass} id="crmMediaUrl" placeholder="https://..." {...register("crmMediaUrl")} /></div>
                <div><label className={labelClass} htmlFor="failedCampaignName">Failed Campaign Name</label><input className={inputClass} id="failedCampaignName" placeholder="Failed campaign" {...register("failedCampaignName")} /></div>
                <div><label className={labelClass} htmlFor="failedMediaUrl">Failed Media URL</label><input className={inputClass} id="failedMediaUrl" placeholder="https://..." {...register("failedMediaUrl")} /></div>
              </div>
            </div>

            <div>
              <h2 className="mb-2 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">Email Body</h2>
              <textarea
                className={`${inputClass} min-h-[180px]`}
                onChange={(event) => setEmailBody(event.target.value)}
                placeholder="Write email body..."
                value={emailBody}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700" type="submit">Save</button>
              <button className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50" type="button" onClick={onClear}>Clear</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
