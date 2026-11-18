"use client";

export function WhatsAppTemplateOptions({ values, onChange, headerType, onHeaderTypeChange, language, onLanguageChange }: {
  values?: string[]; onChange: (values: string[] | undefined) => void;
  headerType: "none" | "image" | "document" | "video";
  onHeaderTypeChange: (value: "none" | "image" | "document" | "video") => void;
  language: string; onLanguageChange: (value: string) => void;
}) {
  return <div className="mt-3 space-y-2 text-xs font-normal text-slate-600">
    <span className="block font-bold">Approved template settings</span>
    <span className="block">Header type</span>
    <select aria-label="Template header type" className="w-full rounded border p-2" value={headerType} onChange={event => onHeaderTypeChange(event.target.value as typeof headerType)}>
      <option value="none">Text / no media</option><option value="image">Image (file URL required)</option><option value="document">Document (file URL required)</option><option value="video">Video (file URL required)</option>
    </select>
    <span className="block">Template language code</span>
    <input aria-label="Template language code" className="w-full rounded border p-2" placeholder="Sender default (e.g. en, hi, gu)" value={language} onChange={event => onLanguageChange(event.target.value)} />
    <span className="block">Body variables</span>
    <select aria-label="Template body variable mode" className="w-full rounded border p-2" value={values === undefined ? "legacy" : "custom"} onChange={event => onChange(event.target.value === "legacy" ? undefined : [])}>
      <option value="legacy">Existing template defaults</option><option value="custom">Custom approved template</option>
    </select>
    {values !== undefined && <>
      <p>Add one value for each body variable, in the approved template order. Leave the list empty for templates without variables.</p>
      <p>{"Use {{name}}, {{workshop_name}}, {{start_date}}, {{registration_no}}, {{batch}}, {{whatsapp_group_link}}, {{waiting_no}}, {{waiting_reason}}, {{referrer_name}}, {{mobile}}, or fixed text."}</p>
      {values.map((value, index) => <div className="flex gap-2" key={index}><input aria-label={`Body variable ${index + 1}`} className="min-w-0 flex-1 rounded border p-2" placeholder={`Variable ${index + 1}`} value={value} onChange={event => onChange(values.map((item, slot) => slot === index ? event.target.value : item))} /><button type="button" onClick={() => onChange(values.filter((_, slot) => slot !== index))}>Remove</button></div>)}
      <button type="button" className="font-bold text-emerald-700" onClick={() => onChange([...values, "{{name}}"])}>+ Add body variable</button>
    </>}
  </div>;
}
