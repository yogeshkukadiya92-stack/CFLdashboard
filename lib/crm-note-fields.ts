export type NoteField = { label: string; value: string; type?: "text" | "number" | "choice" | "yesno" | "date" | "address"; section?: string; required?: boolean; options?: string[] };
export function cleanNoteFields(value: unknown): NoteField[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error("You can add up to 50 questions.");
  const fields = value.map((raw): NoteField => {
    if (!raw || typeof raw !== "object") throw new Error("Check your questions.");
    const f = raw as NoteField;
    if (typeof f.label !== "string" || !f.label.trim() || f.label.length > 100 || typeof f.value !== "string" || f.value.length > 4000) throw new Error("Add a short question name and an answer under 4000 characters.");
    const type = f.type ?? "text";
    if (!["text","number","choice","yesno","date","address"].includes(type)) throw new Error("Choose a valid answer type.");
    const options = Array.isArray(f.options) ? f.options.map(String).map(v => v.trim()).filter(Boolean) : [];
    if (options.length > 30 || new Set(options).size !== options.length || options.some(v => v.length > 100)) throw new Error("Use up to 30 short choices.");
    const answer = f.value.trim();
    if (type === "number" && answer && (!Number.isFinite(Number(answer)) || Number(answer) < 0)) throw new Error(`${f.label}: enter a number of zero or more.`);
    if (type === "yesno" && answer && !["Yes","No"].includes(answer)) throw new Error(`${f.label}: choose Yes or No.`);
    if (type === "choice" && answer && !options.includes(answer)) throw new Error(`${f.label}: choose an answer from the list.`);
    if (type === "date" && answer && (!/^\d{4}-\d{2}-\d{2}$/.test(answer) || Number.isNaN(Date.parse(answer)) || new Date(answer).toISOString().slice(0,10) !== answer)) throw new Error(`${f.label}: choose a valid date.`);
    return { label: f.label.trim(), value: answer, type, section: String(f.section || "Business details").slice(0,80), required: f.required === true, options };
  });
  if (new Set(fields.map(f=>f.label.toLowerCase())).size !== fields.length) throw new Error("Use a different name for each question.");
  return fields;
}
export const businessNoteFields: NoteField[] = [
  ["Business name","text","Business details"], ["Business type","text","Business details"],
  ["Turnover (INR)","number","Business details"], ["Turnover period","choice","Business details"],
  ["Team members","number","Business details"], ["City / Location","text","Business details"], ["Address","address","Business details"],
  ["Main problem","text","Customer needs"], ["Service needed","text","Customer needs"], ["Budget (INR)","number","Customer needs"],
  ["Who makes the decision?","text","Customer needs"], ["When do they want to start?","date","Customer needs"]
].map(([label,type,section])=>({label,type:type as NoteField["type"],section,value:"",options: label === "Turnover period" ? ["Monthly","Yearly"] : []}));
