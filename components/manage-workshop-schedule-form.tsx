"use client";

import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

type ScheduleFormValues = {
  transferLeadToCrm: boolean;
  workshopId: string;
  facilitator: string;
  venue: string;
  linkType: "NA" | "Telegram" | "Whatsapp";
  batch: string;
  isPaidWorkshop: boolean;
  feesWithGst: number | "";
  isPartPaymentAllow: boolean;
  minimumPartPayment: number | "";
  discountType: "percent" | "flat";
  discountValue: number | "";
  discountDescription: string;
  discountEod: string;
  orderQtyTitle: string;
  minOrderQty: number | "";
  maxOrderQty: number | "";
  redirectUrl: string;
  startDate: string;
  endDate: string;
  lastRegistrationDate: string;
  workshopDescription: string;
  campaignName: string;
  mediaUrl: string;
  failedCampaignName: string;
  failedMediaUrl: string;
  uid: string;
  hid: string;
  campaignId: string;
  autoLeadAssign: boolean;
  sendEmailAfterRegistration: boolean;
  emailId: string;
  emailSubject: string;
  emailBody: string;
};

export function ManageWorkshopScheduleForm({
  facilitators,
  onClear,
  onSave,
  venues,
  workshops
}: {
  facilitators: string[];
  onClear?: () => void;
  onSave?: (data: ScheduleFormValues) => void;
  venues: string[];
  workshops: Array<{ id: string; title: string }>;
}) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const {
    handleSubmit,
    register,
    reset,
    watch
  } = useForm<ScheduleFormValues>({
    defaultValues: {
      autoLeadAssign: false,
      batch: "",
      campaignId: "",
      campaignName: "",
      discountDescription: "",
      discountEod: "",
      discountType: "flat",
      discountValue: "",
      emailBody: "",
      emailId: "",
      emailSubject: "",
      endDate: "",
      failedCampaignName: "",
      failedMediaUrl: "",
      facilitator: "",
      feesWithGst: "",
      hid: "",
      isPaidWorkshop: false,
      isPartPaymentAllow: false,
      lastRegistrationDate: "",
      linkType: "NA",
      maxOrderQty: "",
      mediaUrl: "",
      minOrderQty: "",
      minimumPartPayment: "",
      orderQtyTitle: "",
      redirectUrl: "",
      sendEmailAfterRegistration: false,
      startDate: "",
      transferLeadToCrm: false,
      uid: "",
      venue: "",
      workshopDescription: "",
      workshopId: ""
    }
  });

  const isPaidWorkshop = watch("isPaidWorkshop");
  const isPartPaymentAllow = watch("isPartPaymentAllow");
  const sendEmailAfterRegistration = watch("sendEmailAfterRegistration");
  const preview = useMemo(() => imagePreview, [imagePreview]);

  const inputClass =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500";
  const labelClass = "mb-1 block text-sm text-gray-600";

  return (
    <div className="rounded-lg bg-gray-50 p-2">
      <div className="flex items-center justify-between rounded-md bg-white px-4 py-3 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-900">Manage Workshop Schedule</h3>
        <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" type="button">
          View Data
        </button>
      </div>

      <form
        className="mx-auto mt-6 max-w-7xl rounded-lg bg-white p-4 shadow-sm md:p-6"
        onSubmit={handleSubmit((data) => onSave?.(data))}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input className="size-4 accent-indigo-600" type="checkbox" {...register("transferLeadToCrm")} />
              Transfer Lead to CRM?
            </label>
          </div>
          <div>
            <label className={labelClass}>Select Workshop</label>
            <select className={inputClass} {...register("workshopId")}>
              <option value="">Select Workshop</option>
              {workshops.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {workshop.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Facilitator</label>
            <select className={inputClass} {...register("facilitator")}>
              <option value="">Select Facilitator</option>
              {facilitators.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Batch</label>
            <input className={inputClass} type="text" {...register("batch")} />
          </div>
          <div>
            <label className={labelClass}>Venue</label>
            <select className={inputClass} {...register("venue")}>
              <option value="">Select Venue</option>
              {venues.map((venue) => (
                <option key={venue} value={venue}>
                  {venue}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Link Type</label>
            <select className={inputClass} {...register("linkType")}>
              <option value="NA">NA</option>
              <option value="Telegram">Telegram</option>
              <option value="Whatsapp">Whatsapp</option>
            </select>
          </div>
          <div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input className="size-4 accent-indigo-600" type="checkbox" {...register("isPaidWorkshop")} />
              Is Paid Workshop?
            </label>
          </div>
          <div>
            <label className={labelClass}>Fees With GST</label>
            <input className={inputClass} disabled={!isPaidWorkshop} type="number" {...register("feesWithGst", { valueAsNumber: true })} />
          </div>
          <div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input className="size-4 accent-indigo-600" type="checkbox" {...register("isPartPaymentAllow")} />
              Is Part Payment Allow?
            </label>
          </div>
          <div>
            <label className={labelClass}>Minimum Part Payment</label>
            <input className={inputClass} disabled={!isPartPaymentAllow} type="number" {...register("minimumPartPayment", { valueAsNumber: true })} />
          </div>
          <div>
            <label className={labelClass}>Discount Type</label>
            <div className="flex items-center gap-4 rounded-md border border-gray-300 px-3 py-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" value="percent" {...register("discountType")} />%
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" value="flat" {...register("discountType")} />
                Flat Amount
              </label>
            </div>
          </div>
          <div>
            <label className={labelClass}>Discount Value</label>
            <input className={inputClass} type="number" {...register("discountValue", { valueAsNumber: true })} />
          </div>
          <div>
            <label className={labelClass}>Discount EOD</label>
            <input className={inputClass} type="date" {...register("discountEod")} />
          </div>
          <div className="md:col-span-3 lg:col-span-4">
            <label className={labelClass}>Discount Description</label>
            <input className={inputClass} type="text" {...register("discountDescription")} />
          </div>
          <div>
            <label className={labelClass}>Order Qty Title</label>
            <input className={inputClass} type="text" {...register("orderQtyTitle")} />
          </div>
          <div>
            <label className={labelClass}>Min Order Qty</label>
            <input className={inputClass} type="number" {...register("minOrderQty", { valueAsNumber: true })} />
          </div>
          <div>
            <label className={labelClass}>Max Order Qty</label>
            <input className={inputClass} type="number" {...register("maxOrderQty", { valueAsNumber: true })} />
          </div>
          <div>
            <label className={labelClass}>Start Date</label>
            <input className={inputClass} type="date" {...register("startDate")} />
          </div>
          <div>
            <label className={labelClass}>End Date</label>
            <input className={inputClass} type="date" {...register("endDate")} />
          </div>
          <div>
            <label className={labelClass}>Last Registration Date</label>
            <input className={inputClass} type="date" {...register("lastRegistrationDate")} />
          </div>
          <div className="md:col-span-2 lg:col-span-2">
            <label className={labelClass}>Re-Direct URL After Registration</label>
            <input className={inputClass} type="text" {...register("redirectUrl")} />
          </div>
          <div className="md:col-span-3 lg:col-span-4">
            <label className={labelClass}>Image Preview [1024 * 576 size]</label>
            <input
              accept="image/*"
              className={inputClass}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  setImagePreview(null);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setImagePreview(String(reader.result));
                reader.readAsDataURL(file);
              }}
              type="file"
            />
            {preview ? <img alt="Workshop preview" className="mt-3 h-40 w-full rounded-md border border-gray-200 object-cover md:w-72" src={preview} /> : null}
          </div>
          <div className="md:col-span-3 lg:col-span-4">
            <label className={labelClass}>Workshop Description</label>
            {/* Replace this textarea with React-Quill/TinyMCE when integrating WYSIWYG */}
            <textarea className={inputClass} rows={5} {...register("workshopDescription")} />
          </div>
        </div>

        <div className="mt-8 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">Third Party API Setup</div>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          <input className={inputClass} placeholder="Campaign Name" {...register("campaignName")} />
          <input className={inputClass} placeholder="Media URL" {...register("mediaUrl")} />
          <input className={inputClass} placeholder="Failed Campaign Name" {...register("failedCampaignName")} />
          <input className={inputClass} placeholder="Failed Media URL" {...register("failedMediaUrl")} />
          <input className={inputClass} placeholder="UID" {...register("uid")} />
          <input className={inputClass} placeholder="HID" {...register("hid")} />
          <input className={inputClass} placeholder="Campaign ID" {...register("campaignId")} />
        </div>

        <div className="mt-8 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">Auto Lead Assign to Sales Person</div>
        <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-700">
          <input className="size-4 accent-indigo-600" type="checkbox" {...register("autoLeadAssign")} />
          Activate Auto Lead Assign
        </label>

        <div className="mt-8 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">Send Email After Registration</div>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          <label className="md:col-span-3 lg:col-span-4 inline-flex items-center gap-2 text-sm text-gray-700">
            <input className="size-4 accent-indigo-600" type="checkbox" {...register("sendEmailAfterRegistration")} />
            Enable Email Notification
          </label>
          <input className={inputClass} disabled={!sendEmailAfterRegistration} placeholder="Email ID" type="email" {...register("emailId")} />
          <input className="md:col-span-2 lg:col-span-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" disabled={!sendEmailAfterRegistration} placeholder="Email Subject" {...register("emailSubject")} />
          <div className="md:col-span-3 lg:col-span-4">
            <label className={labelClass}>Email Body</label>
            {/* Replace this textarea with React-Quill/TinyMCE when integrating WYSIWYG */}
            <textarea className={inputClass} disabled={!sendEmailAfterRegistration} rows={5} {...register("emailBody")} />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700" type="submit">
            Save
          </button>
          <button
            className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => {
              reset();
              setImagePreview(null);
              onClear?.();
            }}
            type="button"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

