"use client";

import { Check, Copy, KeyRound, Loader2, Plus, RotateCw, Send, Trash2, Webhook } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ApiKey = { createdAt: string; id: string; lastUsedAt: string | null; name: string; prefix: string; scopes: string[] };
type WebhookItem = { createdAt: string; enabled: boolean; events: string[]; id: string; name: string; url: string };
type Delivery = { deliveredAt: string; error: string; event: string; id: string; responseStatus: number | null; success: boolean; webhookId: string };

const endpoint = "/api/integrations/hub";

export function IntegrationHubPanel({ appUrl }: { appUrl: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [keyName, setKeyName] = useState("");
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [newToken, setNewToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const customerEndpoint = useMemo(() => `${appUrl || (typeof window !== "undefined" ? window.location.origin : "https://your-domain.com")}/api/v1/customers`, [appUrl]);

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load Integration Hub.");
    setKeys(data.apiKeys ?? []);
    setWebhooks(data.webhooks ?? []);
    setDeliveries(data.deliveries ?? []);
  }, []);

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [load]);

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, { body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }, method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed.");
      await load();
      return data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createKey() {
    if (!keyName.trim()) return setMessage("Enter a name for the API key.");
    const data = await action({ action: "create_api_key", name: keyName, scopes: ["customers:read", "customers:write"] });
    if (data?.apiKey?.token) {
      setNewToken(data.apiKey.token);
      setKeyName("");
      setMessage("API key created. Copy it now; it will not be shown again.");
    }
  }

  async function createHook() {
    if (!webhookName.trim() || !webhookUrl.trim()) return setMessage("Webhook name and HTTPS URL are required.");
    const data = await action({ action: "create_webhook", events: ["customer.created", "customer.updated"], name: webhookName, url: webhookUrl });
    if (data?.webhook?.secret) {
      setNewSecret(data.webhook.secret);
      setWebhookName("");
      setWebhookUrl("");
      setMessage("Webhook connected. Copy its signing secret now.");
    }
  }

  async function remove(type: "api_key" | "webhook", id: string) {
    if (!window.confirm(type === "api_key" ? "Revoke this API key? Connected apps will stop working." : "Delete this webhook?")) return;
    setBusy(true);
    const response = await fetch(`${endpoint}?type=${type}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Could not remove integration.");
    setMessage(type === "api_key" ? "API key revoked." : "Webhook deleted.");
    await load();
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Copied to clipboard.");
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Integration Hub</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Customer API & Webhooks</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Connect CRM, forms, automation tools, mobile apps or any custom software to the same CFL customer database.</p>
        </div>
        <button aria-label="Refresh integrations" className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" disabled={busy} onClick={() => load()} title="Refresh" type="button">
          <RotateCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
        </button>
      </div>

      {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white"><KeyRound className="size-5" /></span>
            <div><h3 className="font-black text-slate-950">API keys</h3><p className="text-xs font-semibold text-slate-500">Read and write customer records securely.</p></div>
          </div>
          <div className="mt-4 flex gap-2">
            <input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" onChange={(event) => setKeyName(event.target.value)} placeholder="Example: n8n production" value={keyName} />
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy} onClick={createKey} type="button"><Plus className="size-4" /> Create</button>
          </div>
          {newToken ? <Reveal label="New API key" onCopy={() => copy(newToken)} value={newToken} /> : null}
          <div className="mt-4 space-y-2">
            {keys.length === 0 ? <Empty text="No API keys created yet." /> : keys.map((key) => (
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3" key={key.id}>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{key.name}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">{key.prefix}... · {key.lastUsedAt ? `Used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}</p></div>
                <button aria-label={`Revoke ${key.name}`} className="grid size-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50" onClick={() => remove("api_key", key.id)} title="Revoke key" type="button"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white"><Webhook className="size-5" /></span>
            <div><h3 className="font-black text-slate-950">Outbound webhooks</h3><p className="text-xs font-semibold text-slate-500">Notify another app when a customer changes.</p></div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" onChange={(event) => setWebhookName(event.target.value)} placeholder="Example: n8n customer sync" value={webhookName} />
            <input className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://app.com/webhook" type="url" value={webhookUrl} />
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2" disabled={busy} onClick={createHook} type="button"><Plus className="size-4" /> Connect Webhook</button>
          </div>
          {newSecret ? <Reveal label="Signing secret" onCopy={() => copy(newSecret)} value={newSecret} /> : null}
          <div className="mt-4 space-y-2">
            {webhooks.length === 0 ? <Empty text="No customer webhooks connected yet." /> : webhooks.map((hook) => {
              const latest = deliveries.find((delivery) => delivery.webhookId === hook.id);
              return <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3" key={hook.id}>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{hook.name}</p><p className="truncate text-xs font-semibold text-slate-500">{hook.url}</p>{latest ? <p className={`mt-1 text-xs font-bold ${latest.success ? "text-emerald-700" : "text-rose-600"}`}>{latest.success ? `Delivered · HTTP ${latest.responseStatus}` : latest.error || "Delivery failed"}</p> : null}</div>
                <button aria-label={`Test ${hook.name}`} className="grid size-9 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50" onClick={() => action({ action: "test_webhook", id: hook.id }).then((data) => data && setMessage(data.result.success ? "Test webhook delivered." : "Webhook endpoint rejected the test."))} title="Send test" type="button"><Send className="size-4" /></button>
                <button aria-label={`Delete ${hook.name}`} className="grid size-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50" onClick={() => remove("webhook", hook.id)} title="Delete webhook" type="button"><Trash2 className="size-4" /></button>
              </div>;
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">API endpoint</p><p className="mt-1 break-all font-mono text-sm">{customerEndpoint}</p></div><button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm font-bold hover:bg-white/20" onClick={() => copy(customerEndpoint)} type="button"><Copy className="size-4" /> Copy</button></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Code title="GET customers" value={`curl -H "Authorization: Bearer YOUR_API_KEY" \\\n  "${customerEndpoint}?limit=25"`} />
          <Code title="POST customer" value={`curl -X POST "${customerEndpoint}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Customer Name","mobile":"9876543210"}'`} />
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-300"><Check className="size-4 text-emerald-300" /> Webhooks are signed with HMAC SHA-256 in the X-CFL-Signature header.</p>
      </div>
      {busy ? <span className="sr-only"><Loader2 className="animate-spin" /> Working</span> : null}
    </section>
  );
}

function Reveal({ label, onCopy, value }: { label: string; onCopy: () => void; value: string }) {
  return <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-black uppercase text-amber-800">{label} · shown once</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs font-bold text-amber-950">{value}</code><button aria-label={`Copy ${label}`} className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-900 text-white" onClick={onCopy} title="Copy" type="button"><Copy className="size-4" /></button></div></div>;
}

function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-sm font-semibold text-slate-400">{text}</p>; }
function Code({ title, value }: { title: string; value: string }) { return <div className="min-w-0 rounded-xl bg-white/5 p-3"><p className="mb-2 text-xs font-black text-emerald-300">{title}</p><pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs leading-5 text-slate-200">{value}</pre></div>; }
