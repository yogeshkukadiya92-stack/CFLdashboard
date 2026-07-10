import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";

export type IntegrationSettings = {
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

export const defaultIntegrationSettings: IntegrationSettings = {
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

const fallbackPath = path.join(process.cwd(), ".data", "integration-settings.json");

function normalizeSettings(input: Partial<IntegrationSettings> | null | undefined): IntegrationSettings {
  return {
    ...defaultIntegrationSettings,
    ...(input ?? {}),
    razorpayEnabled: Boolean(input?.razorpayEnabled)
  };
}

export async function getIntegrationSettings() {
  if (await isDbEnabled()) {
    try {
      const state = await getAppState();
      return normalizeSettings(state?.integrations as Partial<IntegrationSettings> | undefined);
    } catch {
      return readFallbackSettings();
    }
  }

  return readFallbackSettings();
}

async function readFallbackSettings() {
  try {
    const raw = await readFile(fallbackPath, "utf8");
    return normalizeSettings(JSON.parse(raw) as Partial<IntegrationSettings>);
  } catch {
    return defaultIntegrationSettings;
  }
}

export async function saveIntegrationSettings(input: Partial<IntegrationSettings>) {
  const settings = normalizeSettings(input);

  if (await isDbEnabled()) {
    await saveAppState({ integrations: settings as unknown as Record<string, unknown> });
    return { persisted: "database" as const, settings };
  }

  await mkdir(path.dirname(fallbackPath), { recursive: true });
  await writeFile(fallbackPath, JSON.stringify(settings, null, 2), "utf8");
  return { persisted: "file" as const, settings };
}

export async function getRazorpayConfig() {
  const settings = await getIntegrationSettings();
  return {
    keyId: process.env.RAZORPAY_KEY_ID || settings.razorpayKeyId,
    keySecret: process.env.RAZORPAY_KEY_SECRET || settings.razorpayKeySecret,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || settings.razorpayWebhookSecret
  };
}
