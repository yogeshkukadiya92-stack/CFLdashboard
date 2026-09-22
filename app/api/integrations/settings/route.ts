import { NextResponse } from "next/server";
import { getIntegrationSettings, getRazorpayConfig, saveIntegrationSettings } from "@/lib/integrations";

function safeSettings(settings: Awaited<ReturnType<typeof getIntegrationSettings>>) {
  return {
    ...settings,
    razorpayEnabled: undefined,
    razorpayKeyId: undefined,
    razorpayKeySecret: undefined,
    razorpayWebhookSecret: undefined,
    resendKey: undefined
  };
}

async function razorpayStatus() {
  const config = await getRazorpayConfig();
  return {
    configured: Boolean(config.keyId && config.keySecret),
    webhookConfigured: Boolean(config.webhookSecret)
  };
}

export async function GET() {
  const settings = await getIntegrationSettings();
  return NextResponse.json({ razorpay: await razorpayStatus(), settings: safeSettings(settings) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const current = await getIntegrationSettings();
    const input = body?.settings ?? {};
    const result = await saveIntegrationSettings({
      ...current,
      ...input,
      razorpayEnabled: false,
      razorpayKeyId: "",
      razorpayKeySecret: "",
      razorpayWebhookSecret: "",
      resendKey: ""
    });
    return NextResponse.json({ ok: true, persisted: result.persisted, razorpay: await razorpayStatus(), settings: safeSettings(result.settings) });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save integration settings" }, { status: 500 });
  }
}
