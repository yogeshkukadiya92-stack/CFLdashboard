import { leadUtmDetails } from "@/lib/registration-utm";

export function LeadCampaignDetails({ sourceDetails }: { sourceDetails?: string[] }) {
  const details = leadUtmDetails(sourceDetails);
  if (!details.length) return null;

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4">
      <h4 className="text-sm font-bold text-slate-800">Campaign attribution</h4>
      <ul className="mt-2 space-y-1 break-words text-sm text-slate-600">
        {details.map((detail) => <li key={detail}>{detail}</li>)}
      </ul>
    </section>
  );
}
