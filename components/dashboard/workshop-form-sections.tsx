import { UseFormRegister } from "react-hook-form";

export type WorkshopFormValues = {
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

export function CoreInfoSection({
  facilitators,
  inputClass,
  isPaidWorkshop,
  isPartPaymentAllowed,
  labelClass,
  register,
  venues,
  workshops
}: {
  facilitators: string[];
  inputClass: string;
  isPaidWorkshop: boolean;
  isPartPaymentAllowed: boolean;
  labelClass: string;
  register: UseFormRegister<WorkshopFormValues>;
  venues: string[];
  workshops: string[];
}) {
  return (
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
    </div>
  );
}

