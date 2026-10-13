"use client";
export function WhatsAppTemplateButtons({ values, onChange }: { values?: string[]; onChange: (values: string[]) => void }) {
  const buttons = values || [];
  return <div className="mt-3 space-y-2">
    <span className="block text-xs font-bold text-slate-600">Template button values</span>
    <p className="text-xs font-normal text-slate-500">Use the button order in your approved provider template. Enter the dynamic URL value or quick reply value expected by your API. Button labels and types are configured with your WhatsApp provider.</p>
    {buttons.map((value, index) => <div key={index} className="flex gap-2"><input aria-label={`Button ${index + 1} value`} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal" placeholder={`Button ${index + 1} link / value`} value={value} onChange={e => onChange(buttons.map((item, i) => i === index ? e.target.value : item))} /><button type="button" aria-label={`Remove button ${index + 1}`} className="text-xs text-red-700" onClick={() => onChange(buttons.filter((_, i) => i !== index))}>Remove</button></div>)}
    <button type="button" className="text-xs font-bold text-emerald-700" onClick={() => onChange([...buttons, ""])}>+ Add button value</button>
  </div>;
}
