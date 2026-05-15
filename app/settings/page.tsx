"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { CheckCircle2, Copy, CreditCard, Mail, MessageCircle, Save, ShieldCheck, Smartphone, Webhook, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

type IntegrationSettings = {
  appUrl: string;
  emailFrom: string;
  razorpayKeyId: string;
  resendKey: string;
  smsProvider: string;
  supabaseUrl: string;
  whatsappProvider: string;
};

const STORAGE_KEY = "cfl_integration_settings_v1";
const defaultSettings: IntegrationSettings = {
  appUrl: "",
  emailFrom: "",
  razorpayKeyId: "",
  resendKey: "",
  smsProvider: "",
  supabaseUrl: "",
  whatsappProvider: ""
};

const envRows = [
  ["DATABASE_URL", "Supabase Postgres pooled connection string"],
  ["RAZORPAY_KEY_ID", "Razorpay key id for order creation"],
  ["RAZORPAY_KEY_SECRET", "Razorpay secret. Keep only in Railway/Coolify variables."],
  ["RAZORPAY_WEBHOOK_SECRET", "Webhook signature verification secret"],
  ["RESEND_API_KEY", "Email sending key"],
  ["WHATSAPP_API_TOKEN", "WhatsApp provider token"],
  ["NEXT_PUBLIC_APP_URL", "Your live app URL"]
];

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) setSettings(JSON.parse(raw) as IntegrationSettings);
  }, []);

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setMessage("Integration checklist saved locally. Add secret keys in Railway/Coolify variables for live payments.");
  }

  function update(key: keyof IntegrationSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  const webhookUrl = `${settings.appUrl || "https://your-domain.com"}/api/webhooks/razorpay`;

  return (
    <AdminPlatformShell
      activeLabel="Settings"
      description="Configure the live integration checklist for Supabase, Razorpay, WhatsApp, Email and SMS."
      title="Integration Settings"
    >
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Live Integration Control</h2>
              <p className="mt-1 text-sm text-slate-500">Use this screen as your setup checklist. Secrets must stay in Railway/Coolify variables.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700" onClick={save} type="button">
              <Save className="size-4" />
              Save Settings
            </button>
          </div>

          {message ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field icon={Webhook} label="Live App URL" onChange={(value) => update("appUrl", value)} placeholder="https://dashboard.yourdomain.com" value={settings.appUrl} />
            <Field icon={ShieldCheck} label="Supabase Project URL" onChange={(value) => update("supabaseUrl", value)} placeholder="https://xxxx.supabase.co" value={settings.supabaseUrl} />
            <Field icon={CreditCard} label="Razorpay Key ID" onChange={(value) => update("razorpayKeyId", value)} placeholder="rzp_live_xxxxx" value={settings.razorpayKeyId} />
            <Field icon={Mail} label="From Email" onChange={(value) => update("emailFrom", value)} placeholder="admin@yourdomain.com" value={settings.emailFrom} />
            <Field icon={MessageCircle} label="WhatsApp Provider" onChange={(value) => update("whatsappProvider", value)} placeholder="AiSensy / Interakt / WATI" value={settings.whatsappProvider} />
            <Field icon={Smartphone} label="SMS Provider" onChange={(value) => update("smsProvider", value)} placeholder="Msg91 / Twilio / Fast2SMS" value={settings.smsProvider} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-700">Razorpay Webhook</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Payment callback URL</h3>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700">
              <span className="min-w-0 flex-1 truncate">{webhookUrl}</span>
              <button className="grid size-9 place-items-center rounded-xl bg-slate-950 text-white" onClick={() => navigator.clipboard.writeText(webhookUrl)} type="button">
                <Copy className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-indigo-900">Razorpay dashboard ma webhook add kari ne payment captured / failed events enable karjo.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Railway / Coolify Variables</h3>
            <div className="mt-4 space-y-2">
              {envRows.map(([key, help]) => (
                <div className="rounded-2xl border border-slate-200 p-3" key={key}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <code className="font-black text-slate-950">{key}</code>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{help}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AdminPlatformShell>
  );
}

function Field({
  icon: Icon,
  label,
  onChange,
  placeholder,
  value
}: {
  icon: LucideIcon;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">
        <Icon className="size-4 text-indigo-600" />
        {label}
      </span>
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
