"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { LandingPageRenderer } from "@/components/landing-page-renderer";
import { hydrateLiveState, LIVE_STATE_STORAGE_KEYS, readLocalArray, saveLiveState } from "@/lib/live-state";
import type { BuilderForm, LandingPageFaq, LandingPageRecord, LandingPageTemplate } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { Check, Copy, ExternalLink, Eye, FileImage, LayoutTemplate, Monitor, Pencil, Plus, Save, Search, Smartphone, Sparkles, Trash2, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

type WorkshopRecord = {
  archived?: boolean;
  batch?: string;
  facilitator?: string;
  id: string;
  name: string;
};

type BuilderTab = "content" | "design" | "link";
type PreviewDevice = "desktop" | "mobile";

const BRAND_LOGO_SRC = "/brand/coach-for-life-logo-horizontal.png";
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const templateOptions: Array<{ accent: string; background: string; description: string; id: LandingPageTemplate; label: string }> = [
  { accent: "#059669", background: "#f7faf9", description: "Warm, credible and health-focused", id: "wellness", label: "Wellness" },
  { accent: "#2563eb", background: "#f8fafc", description: "Bold workshop and event energy", id: "event", label: "Event" },
  { accent: "#22c55e", background: "#08111f", description: "Premium dark presentation", id: "executive", label: "Executive" }
];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function createDraft(): LandingPageRecord {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    workshopId: "",
    workshopName: "",
    workshopSlug: "",
    slug: "",
    headline: "",
    subheadline: "",
    description: "",
    ctaLabel: "Register Now",
    highlights: ["Practical guidance from an experienced facilitator", "A clear action plan you can use immediately", "Supportive learning with like-minded participants"],
    schedule: "",
    venue: "",
    facilitator: "",
    testimonialQuote: "",
    testimonialAuthor: "",
    faqs: [],
    template: "wellness",
    accentColor: "#059669",
    backgroundColor: "#f7faf9",
    published: false,
    createdAt: now,
    updatedAt: now
  };
}

export default function LandingPagesPage() {
  const [pages, setPages] = useState<LandingPageRecord[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopRecord[]>([]);
  const [forms, setForms] = useState<BuilderForm[]>([]);
  const [draft, setDraft] = useState<LandingPageRecord | null>(null);
  const [tab, setTab] = useState<BuilderTab>("content");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LandingPageRecord | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function load() {
      setPages(readLocalArray<LandingPageRecord>(LIVE_STATE_STORAGE_KEYS.landingPages));
      setWorkshops(readLocalArray<WorkshopRecord>(LIVE_STATE_STORAGE_KEYS.workshops).filter((item) => !item.archived));
      setForms(readLocalArray<BuilderForm>(LIVE_STATE_STORAGE_KEYS.forms));
    }
    load();
    void hydrateLiveState().then(load);
  }, []);

  const deferredDraft = useDeferredValue(draft);
  const filteredPages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pages;
    return pages.filter((page) => [page.headline, page.workshopName, page.slug].some((value) => value.toLowerCase().includes(query)));
  }, [pages, search]);
  const linkedForm = draft ? forms.find((form) => form.workshopId === draft.workshopId || form.workshopSlug === draft.workshopSlug) : undefined;

  function updateDraft(patch: Partial<LandingPageRecord>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setMessage("");
  }

  function startCreate() {
    setDraft(createDraft());
    setTab("content");
    setMessage("");
    window.requestAnimationFrame(() => window.scrollTo({ behavior: "smooth", top: 0 }));
  }

  function startEdit(page: LandingPageRecord) {
    setDraft({ ...page, highlights: [...page.highlights], faqs: page.faqs.map((faq) => ({ ...faq })) });
    setTab("content");
    setMessage("");
    window.requestAnimationFrame(() => window.scrollTo({ behavior: "smooth", top: 0 }));
  }

  function selectWorkshop(id: string) {
    const workshop = workshops.find((item) => item.id === id);
    if (!workshop) return updateDraft({ workshopId: "", workshopName: "", workshopSlug: "" });
    const form = forms.find((item) => item.workshopId === workshop.id);
    updateDraft({
      workshopId: workshop.id,
      workshopName: workshop.name,
      workshopSlug: form?.workshopSlug || slugify(workshop.name),
      headline: draft?.headline || workshop.name,
      subheadline: draft?.subheadline || form?.tagline || `A focused experience created to help you get more from ${workshop.name}.`,
      description: draft?.description || stripHtml(form?.description ?? "Join us for a practical, supportive workshop designed to create meaningful progress."),
      facilitator: draft?.facilitator || workshop.facilitator || "",
      schedule: draft?.schedule || workshop.batch || "",
      slug: draft?.slug || `${slugify(workshop.name)}-workshop`,
      logoUrl: draft?.logoUrl || form?.theme.logoUrl
    });
  }

  async function saveDraft(publish = draft?.published ?? false) {
    if (!draft) return;
    const slug = slugify(draft.slug);
    if (!draft.workshopId || !draft.headline.trim() || !slug) {
      setMessage("Please select a workshop and add headline and custom URL.");
      return;
    }
    if (pages.some((page) => page.id !== draft.id && page.slug === slug)) {
      setMessage("This custom URL is already used. Please choose another one.");
      setTab("link");
      return;
    }
    if (publish && !linkedForm) {
      setMessage("Create the workshop registration form first, then publish this landing page.");
      return;
    }
    const cleaned: LandingPageRecord = {
      ...draft,
      slug,
      headline: draft.headline.trim(),
      subheadline: draft.subheadline.trim(),
      description: draft.description.trim(),
      ctaLabel: draft.ctaLabel.trim() || "Register Now",
      highlights: draft.highlights.map((item) => item.trim()).filter(Boolean),
      faqs: draft.faqs.filter((faq) => faq.question.trim() && faq.answer.trim()),
      published: publish,
      updatedAt: new Date().toISOString()
    };
    const next = [cleaned, ...pages.filter((page) => page.id !== cleaned.id)];
    setPages(next);
    setDraft(cleaned);
    const saved = await saveLiveState({ landingPages: next });
    setMessage(saved ? (publish ? "Landing page published successfully." : "Draft saved successfully.") : "Saved locally, but server sync failed. Please try again.");
  }

  async function duplicatePage(page: LandingPageRecord) {
    const copy = { ...page, id: generateId(), slug: `${page.slug}-copy`, headline: `${page.headline} Copy`, published: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const next = [copy, ...pages];
    setPages(next);
    await saveLiveState({ landingPages: next });
    startEdit(copy);
    setMessage("Landing page duplicated as a draft.");
  }

  async function deletePage() {
    if (!deleteTarget) return;
    const next = pages.filter((page) => page.id !== deleteTarget.id);
    setPages(next);
    if (draft?.id === deleteTarget.id) setDraft(null);
    setDeleteTarget(null);
    await saveLiveState({ landingPages: next });
    setMessage("Landing page deleted.");
  }

  async function uploadImage(file: File | undefined, kind: "hero" | "logo") {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) {
      setMessage("Please select an image smaller than 8 MB.");
      return;
    }
    try {
      const dataUrl = await compressImage(file, kind === "hero" ? 1440 : 520);
      updateDraft(kind === "hero" ? { heroImageUrl: dataUrl } : { logoUrl: dataUrl });
    } catch {
      setMessage("Image could not be processed. Please try another file.");
    }
  }

  if (draft) {
    return (
      <AdminPlatformShell activeLabel="Landing Pages" description="Build polished campaign pages connected to your workshop registration flow." title="Landing Page Builder">
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
              <div><p className="text-xs font-black uppercase text-emerald-700">Landing page</p><h2 className="mt-2 text-2xl font-black">{draft.headline || "New landing page"}</h2><p className="mt-1 text-sm text-slate-500">Connected to one workshop and its existing response list.</p></div>
              <button aria-label="Close builder" className="grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setDraft(null)} type="button"><X className="size-4" /></button>
            </div>

            {message ? <div className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${message.includes("Please") || message.includes("failed") || message.includes("first") || message.includes("already") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</div> : null}

            <div className="mt-5 grid grid-cols-3 rounded-xl border border-slate-200 p-1">
              {(["content", "design", "link"] as const).map((item) => <button className={`rounded-lg px-3 py-2.5 text-sm font-black capitalize ${tab === item ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50"}`} key={item} onClick={() => setTab(item)} type="button">{item === "link" ? "Link & Publish" : item}</button>)}
            </div>

            {tab === "content" ? (
              <div className="mt-6 space-y-5">
                <Field label="Workshop"><select className={inputClass} onChange={(event) => selectWorkshop(event.target.value)} value={draft.workshopId}><option value="">Select workshop</option>{workshops.map((workshop) => <option key={workshop.id} value={workshop.id}>{workshop.name}</option>)}</select>{draft.workshopId && !linkedForm ? <p className="mt-2 text-xs font-bold text-amber-700">Registration form is not ready for this workshop.</p> : null}</Field>
                <Field label="Main headline"><input className={inputClass} maxLength={100} onChange={(event) => updateDraft({ headline: event.target.value })} placeholder="Workshop name or clear offer" value={draft.headline} /></Field>
                <Field label="Supporting headline"><textarea className={`${inputClass} min-h-24 resize-y`} maxLength={260} onChange={(event) => updateDraft({ subheadline: event.target.value })} placeholder="Why should someone join?" value={draft.subheadline} /></Field>
                <Field label="About this workshop"><textarea className={`${inputClass} min-h-32 resize-y`} onChange={(event) => updateDraft({ description: event.target.value })} placeholder="Workshop details and value" value={draft.description} /></Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Schedule"><textarea className={`${inputClass} min-h-24 resize-y`} onChange={(event) => updateDraft({ schedule: event.target.value })} placeholder="Date and time" value={draft.schedule ?? ""} /></Field>
                  <Field label="Venue"><textarea className={`${inputClass} min-h-24 resize-y`} onChange={(event) => updateDraft({ venue: event.target.value })} placeholder="Online or location" value={draft.venue ?? ""} /></Field>
                  <Field label="Facilitator"><textarea className={`${inputClass} min-h-24 resize-y`} onChange={(event) => updateDraft({ facilitator: event.target.value })} placeholder="Facilitator name" value={draft.facilitator ?? ""} /></Field>
                </div>

                <Repeater label="Benefits / highlights" addLabel="Add benefit" onAdd={() => updateDraft({ highlights: [...draft.highlights, ""] })}>
                  {draft.highlights.map((item, index) => <RowInput key={index} value={item} placeholder={`Benefit ${index + 1}`} onChange={(value) => updateDraft({ highlights: draft.highlights.map((entry, itemIndex) => itemIndex === index ? value : entry) })} onRemove={() => updateDraft({ highlights: draft.highlights.filter((_, itemIndex) => itemIndex !== index) })} />)}
                </Repeater>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Testimonial"><textarea className={`${inputClass} min-h-28 resize-y`} onChange={(event) => updateDraft({ testimonialQuote: event.target.value })} placeholder="Participant feedback" value={draft.testimonialQuote ?? ""} /></Field>
                  <Field label="Participant name"><input className={inputClass} onChange={(event) => updateDraft({ testimonialAuthor: event.target.value })} placeholder="Name and role" value={draft.testimonialAuthor ?? ""} /></Field>
                </div>

                <Repeater label="Frequently asked questions" addLabel="Add FAQ" onAdd={() => updateDraft({ faqs: [...draft.faqs, { id: generateId(), question: "", answer: "" }] })}>
                  {draft.faqs.map((faq) => <FaqEditor faq={faq} key={faq.id} onChange={(patch) => updateDraft({ faqs: draft.faqs.map((item) => item.id === faq.id ? { ...item, ...patch } : item) })} onRemove={() => updateDraft({ faqs: draft.faqs.filter((item) => item.id !== faq.id) })} />)}
                </Repeater>
              </div>
            ) : null}

            {tab === "design" ? (
              <div className="mt-6 space-y-6">
                <div><p className="text-sm font-black text-slate-700">Page style</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{templateOptions.map((option) => <button className={`border p-4 text-left ${draft.template === option.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`} key={option.id} onClick={() => updateDraft({ template: option.id, accentColor: option.accent, backgroundColor: option.background })} type="button"><span className="block size-5 rounded-full" style={{ background: option.accent }} /><span className="mt-3 block font-black">{option.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span></button>)}</div></div>
                <div className="grid gap-4 sm:grid-cols-2"><ColorField label="Accent color" value={draft.accentColor} onChange={(value) => updateDraft({ accentColor: value })} /><ColorField label="Page background" value={draft.backgroundColor} onChange={(value) => updateDraft({ backgroundColor: value })} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ImageUpload label="Hero image" value={draft.heroImageUrl} inputRef={heroInputRef} onPick={() => heroInputRef.current?.click()} onRemove={() => updateDraft({ heroImageUrl: undefined })} onFile={(file) => void uploadImage(file, "hero")} />
                  <ImageUpload label="Page logo" value={draft.logoUrl || BRAND_LOGO_SRC} inputRef={logoInputRef} onPick={() => logoInputRef.current?.click()} onRemove={() => updateDraft({ logoUrl: undefined })} onFile={(file) => void uploadImage(file, "logo")} />
                </div>
              </div>
            ) : null}

            {tab === "link" ? (
              <div className="mt-6 space-y-5">
                <Field label="Custom landing page URL"><div className="flex min-w-0 rounded-xl border border-slate-200 bg-slate-50"><span className="hidden shrink-0 items-center border-r border-slate-200 px-3 text-sm font-bold text-slate-500 sm:flex">{typeof window !== "undefined" ? window.location.origin : ""}/lp/</span><input className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm font-bold outline-none" onChange={(event) => updateDraft({ slug: slugify(event.target.value) })} placeholder="healthy-forever" value={draft.slug} /></div><p className="mt-2 text-xs font-semibold text-slate-500">Lowercase letters, numbers and hyphens only.</p></Field>
                <Field label="Registration button text"><input className={inputClass} maxLength={40} onChange={(event) => updateDraft({ ctaLabel: event.target.value })} value={draft.ctaLabel} /></Field>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><div><p className="font-black">Publish status</p><p className="mt-1 text-sm text-slate-500">Published pages can be opened by anyone with the link.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${draft.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{draft.published ? "Published" : "Draft"}</span></div>
                {draft.published && draft.slug ? <a className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-50" href={`/lp/${draft.slug}`} rel="noreferrer" target="_blank"><ExternalLink className="size-4" />Open public page</a> : null}
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50" onClick={() => void saveDraft(false)} type="button"><Save className="size-4" />Save Draft</button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700" onClick={() => void saveDraft(true)} type="button"><Check className="size-4" />{draft.published ? "Update Published Page" : "Publish Page"}</button>
            </div>
          </section>

          <aside className="min-w-0 xl:sticky xl:top-5 xl:h-[calc(100vh-40px)]">
            <div className="flex items-center justify-between gap-3 pb-3"><div><p className="text-xs font-black uppercase text-emerald-700">Live preview</p><p className="mt-1 text-sm font-bold text-slate-500">Updates as you type</p></div><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button aria-label="Desktop preview" className={`grid size-9 place-items-center rounded-lg ${device === "desktop" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => setDevice("desktop")} type="button"><Monitor className="size-4" /></button><button aria-label="Mobile preview" className={`grid size-9 place-items-center rounded-lg ${device === "mobile" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => setDevice("mobile")} type="button"><Smartphone className="size-4" /></button></div></div>
            <div className="h-[calc(100%-64px)] overflow-auto rounded-2xl border border-slate-200 bg-slate-200 p-2 shadow-inner"><div className={`${device === "mobile" ? "mx-auto max-w-[390px]" : "w-full"} min-h-full overflow-hidden bg-white shadow-xl`}>{deferredDraft ? <LandingPageRenderer page={{ ...deferredDraft, headline: deferredDraft.headline || "Your workshop headline", subheadline: deferredDraft.subheadline || "A clear reason for people to join your workshop.", workshopName: deferredDraft.workshopName || "Your Workshop" }} preview /> : null}</div></div>
          </aside>
        </div>
      </AdminPlatformShell>
    );
  }

  return (
    <AdminPlatformShell activeLabel="Landing Pages" description="Create high-converting workshop pages with custom links and shared registration responses." title="Landing Pages">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase text-emerald-700">Workshop marketing</p><h2 className="mt-2 text-2xl font-black">Landing Page Library</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Build a premium page for any workshop. Every registration continues into the same workshop response table.</p></div><button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700" onClick={startCreate} type="button"><Plus className="size-4" />Create Landing Page</button></div>
        {message ? <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="Total pages" value={pages.length} /><Stat label="Published" value={pages.filter((page) => page.published).length} /><Stat label="Drafts" value={pages.filter((page) => !page.published).length} /></div>
        <label className="relative mt-6 block max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder="Search page, workshop or URL..." value={search} /></label>

        {filteredPages.length ? <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Page", "Workshop", "Custom URL", "Status", "Updated", "Actions"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredPages.map((page) => <tr className="hover:bg-emerald-50/30" key={page.id}><td className="px-4 py-4"><p className="font-black text-slate-950">{page.headline}</p><p className="mt-1 text-xs capitalize text-slate-500">{page.template} style</p></td><td className="px-4 py-4 font-bold">{page.workshopName}</td><td className="px-4 py-4"><span className="font-mono text-xs text-slate-600">/lp/{page.slug}</span></td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${page.published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{page.published ? "Published" : "Draft"}</span></td><td className="px-4 py-4 text-slate-500">{formatDate(page.updatedAt)}</td><td className="px-4 py-4"><div className="flex gap-2">{page.published ? <a aria-label="Open public page" className="grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100" href={`/lp/${page.slug}`} target="_blank"><Eye className="size-4" /></a> : null}<button aria-label="Edit page" className="grid size-9 place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => startEdit(page)} type="button"><Pencil className="size-4" /></button><button aria-label="Duplicate page" className="grid size-9 place-items-center rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100" onClick={() => void duplicatePage(page)} type="button"><Copy className="size-4" /></button><button aria-label="Delete page" className="grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => setDeleteTarget(page)} type="button"><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table></div> : <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm"><LayoutTemplate className="size-6" /></span><h3 className="mt-4 text-xl font-black">Create your first landing page</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Choose a workshop, customize the page, publish a custom link and start collecting responses.</p><button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white" onClick={startCreate} type="button"><Sparkles className="size-4" />Start Building</button></div></div>}
      </section>
      <ConfirmDialog confirmLabel="Delete Landing Page" description="The public link will stop working. Workshop responses are not deleted." onCancel={() => setDeleteTarget(null)} onConfirm={() => void deletePage()} open={Boolean(deleteTarget)} title="Delete landing page?">{deleteTarget ? `${deleteTarget.headline} · /lp/${deleteTarget.slug}` : null}</ConfirmDialog>
    </AdminPlatformShell>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="block"><span className="mb-2 block text-sm font-black text-slate-700">{label}</span>{children}</label>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="border-b-2 border-emerald-500 bg-slate-50 px-4 py-4"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>; }
function Repeater({ addLabel, children, label, onAdd }: { addLabel: string; children: React.ReactNode; label: string; onAdd: () => void }) { return <div><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-700">{label}</p><button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50" onClick={onAdd} type="button"><Plus className="size-3.5" />{addLabel}</button></div><div className="mt-3 space-y-3">{children}</div></div>; }
function RowInput({ onChange, onRemove, placeholder, value }: { onChange: (value: string) => void; onRemove: () => void; placeholder: string; value: string }) { return <div className="flex gap-2"><input className={inputClass} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} /><button aria-label="Remove item" className="grid size-11 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={onRemove} type="button"><Trash2 className="size-4" /></button></div>; }
function FaqEditor({ faq, onChange, onRemove }: { faq: LandingPageFaq; onChange: (patch: Partial<LandingPageFaq>) => void; onRemove: () => void }) { return <div className="border-l-2 border-emerald-500 bg-slate-50 p-4"><div className="flex items-start gap-2"><div className="min-w-0 flex-1 space-y-3"><input className={inputClass} onChange={(event) => onChange({ question: event.target.value })} placeholder="Question" value={faq.question} /><textarea className={`${inputClass} min-h-24 resize-y`} onChange={(event) => onChange({ answer: event.target.value })} placeholder="Answer" value={faq.answer} /></div><button aria-label="Remove FAQ" className="grid size-10 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-50" onClick={onRemove} type="button"><Trash2 className="size-4" /></button></div></div>; }
function ColorField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) { return <Field label={label}><div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"><input aria-label={label} className="size-9 min-h-0 cursor-pointer border-0 p-0" onChange={(event) => onChange(event.target.value)} type="color" value={value} /><span className="font-mono text-sm font-black uppercase text-slate-600">{value}</span></div></Field>; }
function ImageUpload({ inputRef, label, onFile, onPick, onRemove, value }: { inputRef: React.RefObject<HTMLInputElement | null>; label: string; onFile: (file?: File) => void; onPick: () => void; onRemove: () => void; value?: string }) { return <div><p className="mb-2 text-sm font-black text-slate-700">{label}</p><div className="flex min-h-32 items-center gap-3 border border-slate-200 bg-slate-50 p-3">{value ? <img alt={label} className="h-24 min-w-0 flex-1 object-contain" src={value} /> : <span className="grid h-24 flex-1 place-items-center text-slate-400"><FileImage className="size-7" /></span>}<div className="space-y-2"><button className="block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black" onClick={onPick} type="button">Choose</button>{value ? <button className="block rounded-lg px-3 py-2 text-xs font-black text-rose-600" onClick={onRemove} type="button">Remove</button> : null}</div><input accept="image/*" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} ref={inputRef} type="file" /></div></div>; }

function stripHtml(value: string) { return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function compressImage(file: File, maxWidth: number): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const image = new window.Image(); image.onload = () => { const scale = image.width > maxWidth ? maxWidth / image.width : 1; const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); const context = canvas.getContext("2d"); if (!context) return reject(new Error("Canvas unavailable")); context.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", 0.82)); }; image.onerror = reject; image.src = String(reader.result); }; reader.onerror = reject; reader.readAsDataURL(file); }); }
