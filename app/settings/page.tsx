"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { CheckCircle2, Copy, CreditCard, Eye, EyeOff, Mail, MessageCircle, Plug, Save, ShieldCheck, Smartphone, Webhook, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

type IntegrationSettings = {
  appUrl: string;
  emailFrom: string;
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  resendKey: string;
  smsProvider: string;
  supabaseUrl: string;
  whatsappProvider: string;
};

const defaultSettings: IntegrationSettings = {
  appUrl: "",
  emailFrom: "",
  razorpayEnabled: false,
  razorpayKeyId: "",
  razorpayKeySecret: "",
  razorpayWebhookSecret: "",
  resendKey: "",
  smsProvider: "",
  supabaseUrl: "",
  whatsappProvider: ""
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/integrations/settings", { cache: "no-store" });
        const data = await response.json();
        if (data?.settings) setSettings({ ...defaultSettings, ...data.settings });
      } catch {
        setMessage("Could not load plugin settings.");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function save() {
    setMessage("");
    try {
      const response = await fetch("/api/integrations/settings", {
        body: JSON.stringify({ settings }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setMessage(data?.error || "Could not save plugin settings.");
        return;
      }
      setSettings({ ...defaultSettings, ...data.settings });
      setMessage(`Plugin settings saved in ${data.persisted === "database" ? "database" : "server storage"}.`);
    } catch {
      setMessage("Could not save plugin settings.");
    }
  }

  function update(key: keyof IntegrationSettings, value: string | boolean) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied.");
    } catch {
      setMessage("Copy blocked. Please select and copy manually.");
    }
  }

  const webhookUrl = `${settings.appUrl || "https://your-domain.com"}/api/webhooks/razorpay`;
  const razorpayReady = settings.razorpayEnabled && Boolean(settings.razorpayKeyId) && Boolean(settings.razorpayKeySecret);

  return (
    <AdminPlatformShell
      activeLabel="Settings"
      description="Add and manage payment, email, WhatsApp, SMS and data plugins from inside the app."
      title="Plugin Manager"
    >
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">App Plugins</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Install Razorpay from app</h2>
                <p className="mt-1 text-sm text-slate-500">Save keys here. Deployment environment variables remain available as an optional fallback.</p>
              </div>
              <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700" disabled={loading} onClick={save} type="button">
                <Save className="size-4" />
                Save Plugins
              </button>
            </div>

            {message ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}

            <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                    <CreditCard className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Razorpay Payments</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Enable online payment order creation and webhook verification.</p>
                  </div>
                </div>
                <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-700">
                  <input checked={settings.razorpayEnabled} className="size-5 accent-emerald-600" onChange={(event) => update("razorpayEnabled", event.target.checked)} type="checkbox" />
                  Enabled
                </label>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field icon={CreditCard} label="Razorpay Key ID" onChange={(value) => update("razorpayKeyId", value)} placeholder="rzp_live_xxxxx" value={settings.razorpayKeyId} />
                <Field icon={ShieldCheck} label="Razorpay Key Secret" onChange={(value) => update("razorpayKeySecret", value)} placeholder="Keep secret" secret={!showSecrets} value={settings.razorpayKeySecret} />
                <Field icon={Webhook} label="Webhook Secret" onChange={(value) => update("razorpayWebhookSecret", value)} placeholder="Webhook signing secret" secret={!showSecrets} value={settings.razorpayWebhookSecret} />
                <Field icon={Webhook} label="Live App URL" onChange={(value) => update("appUrl", value)} placeholder="https://dashboard.yourdomain.com" value={settings.appUrl} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => setShowSecrets((value) => !value)} type="button">
                  {showSecrets ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {showSecrets ? "Hide Secrets" : "Show Secrets"}
                </button>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${razorpayReady ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-800"}`}>
                  {razorpayReady ? "Ready" : "Needs keys"}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field icon={ShieldCheck} label="Supabase Project URL" onChange={(value) => update("supabaseUrl", value)} placeholder="https://xxxx.supabase.co" value={settings.supabaseUrl} />
              <Field icon={Mail} label="From Email" onChange={(value) => update("emailFrom", value)} placeholder="admin@yourdomain.com" value={settings.emailFrom} />
              <Field icon={MessageCircle} label="WhatsApp Provider" onChange={(value) => update("whatsappProvider", value)} placeholder="AiSensy / Interakt / WATI" value={settings.whatsappProvider} />
              <Field icon={Smartphone} label="SMS Provider" onChange={(value) => update("smsProvider", value)} placeholder="Msg91 / Twilio / Fast2SMS" value={settings.smsProvider} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-700">Razorpay Webhook</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Payment callback URL</h3>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700">
              <span className="min-w-0 flex-1 truncate">{webhookUrl}</span>
              <button className="grid size-9 place-items-center rounded-xl bg-slate-950 text-white" onClick={() => copyText(webhookUrl)} type="button">
                <Copy className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-indigo-900">Add this webhook URL in the Razorpay dashboard. Keys and secrets can be saved from this app.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-xl font-black text-slate-950"><Plug className="size-5 text-emerald-700" /> Plugin Status</h3>
            <div className="mt-4 space-y-2">
              <StatusRow ready={razorpayReady} title="Razorpay" />
              <StatusRow ready={Boolean(settings.emailFrom)} title="Email sender" />
              <StatusRow ready={Boolean(settings.whatsappProvider)} title="WhatsApp provider" />
              <StatusRow ready={Boolean(settings.smsProvider)} title="SMS provider" />
            </div>
          </div>
        </div>
      </section>
    </AdminPlatformShell>
  );
}

function StatusRow({ ready, title }: { ready: boolean; title: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className={`size-4 ${ready ? "text-emerald-600" : "text-slate-300"}`} />
        <span className="font-black text-slate-950">{title}</span>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-black ${ready ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
        {ready ? "Configured" : "Pending"}
      </span>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  onChange,
  placeholder,
  secret,
  value
}: {
  icon: LucideIcon;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  secret?: boolean;
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
        type={secret ? "password" : "text"}
        value={value}
      />
    </label>
  );
}
