"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { WorkshopPageHeader } from "@/components/dashboard/workshop-page-header";
import { CoreInfoSection, type WorkshopFormValues } from "@/components/dashboard/workshop-form-sections";

const sidebarLinks = ["Dashboard", "Workshops", "Reports", "Settings"];
const workshops = ["Leadership Sprint", "Sales Mastery", "Mindset Reset", "Business Acceleration Bootcamp"];
const facilitators = ["Dr Luv Patel", "Arjun Sharma", "Neha Kapoor", "Amit Verma"];
const venues = ["Surat", "Ahmedabad", "Mumbai", "Online Zoom"];

export default function WorkshopSchedulingAdminPage() {
  const [workshopDescription, setWorkshopDescription] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { handleSubmit, register, reset, watch } = useForm<WorkshopFormValues>({
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

  function onSubmit(data: WorkshopFormValues) {
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
        <SidebarNav items={sidebarLinks} />

        <section className="rounded-lg bg-white p-4 shadow-sm md:p-6">
          <WorkshopPageHeader />

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <CoreInfoSection
              facilitators={facilitators}
              inputClass={inputClass}
              isPaidWorkshop={isPaidWorkshop}
              isPartPaymentAllowed={isPartPaymentAllowed}
              labelClass={labelClass}
              register={register}
              venues={venues}
              workshops={workshops}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
