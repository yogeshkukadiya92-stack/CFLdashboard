"use client";

import type { CSSProperties } from "react";
import { ArrowRight, CalendarDays, Check, MapPin, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { LandingPageRecord } from "@/lib/types";

const BRAND_LOGO_SRC = "/brand/coach-for-life-logo-horizontal.png";

function withAlpha(hex: string, alpha: string) {
  const normalized = hex.replace("#", "");
  return normalized.length === 6 ? `#${normalized}${alpha}` : hex;
}

export function LandingPageRenderer({ page, preview = false }: { page: LandingPageRecord; preview?: boolean }) {
  const registrationUrl = `/register/${page.workshopSlug}?source=landing-page&landing=${encodeURIComponent(page.slug)}`;
  const actionUrl = preview ? "#landing-preview-form" : registrationUrl;
  const style = {
    "--lp-accent": page.accentColor,
    "--lp-accent-soft": withAlpha(page.accentColor, "14"),
    "--lp-bg": page.backgroundColor
  } as CSSProperties;
  const executive = page.template === "executive";
  const event = page.template === "event";

  return (
    <div className={`cfl-landing-page ${executive ? "text-slate-100" : "text-slate-950"} min-h-full overflow-hidden`} style={{ ...style, background: executive ? "#08111f" : "var(--lp-bg)" }}>
      <header className={`border-b ${executive ? "border-white/10 bg-slate-950/90" : "border-slate-200/80 bg-white/90"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <img alt="Coach For Life" className="h-12 w-auto max-w-[190px] object-contain" src={page.logoUrl || BRAND_LOGO_SRC} />
          <a className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black text-white shadow-sm" href={actionUrl} style={{ backgroundColor: "var(--lp-accent)" }}>
            {page.ctaLabel}
            <ArrowRight className="size-4" />
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto grid min-h-[560px] max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-black leading-[1.06] sm:text-5xl lg:text-6xl">{page.headline}</h1>
            <p className={`mt-6 max-w-xl text-lg font-bold leading-8 ${executive ? "text-slate-300" : "text-slate-600"}`}>{page.subheadline}</p>
            <div className={`mt-7 max-w-xl whitespace-pre-line text-base font-medium leading-7 ${executive ? "text-slate-400" : "text-slate-500"}`}>{page.description}</div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a className="inline-flex min-h-12 items-center gap-2 rounded-lg px-6 py-3 text-base font-black text-white shadow-lg" href={actionUrl} style={{ backgroundColor: "var(--lp-accent)" }}>
                {page.ctaLabel}
                <ArrowRight className="size-5" />
              </a>
              <span className={`inline-flex items-center gap-2 text-sm font-bold ${executive ? "text-slate-400" : "text-slate-500"}`}><ShieldCheck className="size-4" /> Secure registration</span>
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
            {page.heroImageUrl ? (
              <img alt={page.workshopName} className="absolute inset-0 size-full object-cover" src={page.heroImageUrl} />
            ) : (
              <div className="absolute inset-0 grid place-items-center p-10" style={{ backgroundColor: "var(--lp-accent-soft)" }}>
                <img alt="Coach For Life" className="w-full max-w-[360px] object-contain" src={page.logoUrl || BRAND_LOGO_SRC} />
              </div>
            )}
            {event ? <div className="absolute bottom-0 left-0 right-0 bg-slate-950/88 p-5 text-white"><p className="text-lg font-black">{page.workshopName}</p><p className="mt-1 text-sm text-slate-300">Reserve your seat today</p></div> : null}
          </div>
        </section>

        {(page.schedule || page.venue || page.facilitator) ? (
          <section className={executive ? "border-y border-white/10 bg-white/[0.04]" : "border-y border-slate-200 bg-white"}>
            <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:px-8 md:grid-cols-3">
              {page.schedule ? <Detail icon={CalendarDays} label="Schedule" value={page.schedule} executive={executive} /> : null}
              {page.venue ? <Detail icon={MapPin} label="Venue" value={page.venue} executive={executive} /> : null}
              {page.facilitator ? <Detail icon={UserRound} label="Facilitator" value={page.facilitator} executive={executive} /> : null}
            </div>
          </section>
        ) : null}

        {page.highlights.length ? (
          <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <Sparkles className="size-9" style={{ color: "var(--lp-accent)" }} />
                <h2 className="mt-5 text-3xl font-black">What you will gain</h2>
                <p className={`mt-4 leading-7 ${executive ? "text-slate-400" : "text-slate-500"}`}>A practical experience designed to help you move forward with clarity and confidence.</p>
              </div>
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {page.highlights.map((item, index) => (
                  <div className={`flex gap-3 border-b pb-5 ${executive ? "border-white/10" : "border-slate-200"}`} key={`${item}-${index}`}>
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: "var(--lp-accent)" }}><Check className="size-4" /></span>
                    <p className="font-bold leading-6">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {page.testimonialQuote ? (
          <section className={executive ? "bg-white/[0.04]" : "bg-white"}>
            <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-8">
              <p className="text-2xl font-black leading-10 sm:text-3xl">“{page.testimonialQuote}”</p>
              {page.testimonialAuthor ? <p className="mt-5 text-sm font-black" style={{ color: "var(--lp-accent)" }}>{page.testimonialAuthor}</p> : null}
            </div>
          </section>
        ) : null}

        {page.faqs.length ? (
          <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-20">
            <h2 className="text-center text-3xl font-black">Frequently asked questions</h2>
            <div className="mt-9 divide-y divide-slate-200 border-y border-slate-200">
              {page.faqs.map((faq) => (
                <details className="group py-5" key={faq.id}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black"><span>{faq.question}</span><span className="text-xl group-open:rotate-45" style={{ color: "var(--lp-accent)" }}>+</span></summary>
                  <p className={`mt-3 max-w-2xl leading-7 ${executive ? "text-slate-400" : "text-slate-500"}`}>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <section className="px-5 pb-16 sm:px-8" id="landing-preview-form">
          <div className="mx-auto max-w-5xl rounded-2xl px-6 py-10 text-center text-white sm:px-10" style={{ backgroundColor: "var(--lp-accent)" }}>
            <h2 className="text-3xl font-black">Ready to join {page.workshopName}?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/80">Complete the registration form and secure your place.</p>
            <a className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-lg bg-white px-6 py-3 font-black text-slate-950" href={actionUrl}>{page.ctaLabel}<ArrowRight className="size-5" /></a>
          </div>
        </section>
      </main>

      <footer className={`border-t px-5 py-6 text-center text-sm font-semibold ${executive ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-500"}`}>
        Coach For Life · Your details are handled securely.
      </footer>
    </div>
  );
}

function Detail({ executive, icon: Icon, label, value }: { executive: boolean; icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: "var(--lp-accent-soft)", color: "var(--lp-accent)" }}><Icon className="size-5" /></span>
      <div><p className={`text-xs font-black uppercase ${executive ? "text-slate-500" : "text-slate-400"}`}>{label}</p><p className="mt-1 whitespace-pre-line font-black leading-6">{value}</p></div>
    </div>
  );
}
