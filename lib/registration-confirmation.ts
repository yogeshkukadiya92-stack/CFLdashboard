import type { BuilderForm, RegistrationEntry } from "@/lib/types";
import { recordOutboundWhatsAppMessage } from "./whatsapp-automation.ts";

import { resolveWhatsAppAccount } from "./whatsapp-accounts.ts";

const REGISTRATION_NUMBER_PATTERN = /^REG-(\d+)$/i;

function readProviderMessageId(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return undefined;
  const value = result as Record<string, unknown>;
  const messages = Array.isArray(value.messages) ? value.messages as Array<Record<string, unknown>> : [];
  const nested = value.data && typeof value.data === "object" && !Array.isArray(value.data) ? value.data as Record<string, unknown> : undefined;
  const nestedMessages = Array.isArray(nested?.messages) ? nested.messages as Array<Record<string, unknown>> : [];
  return String(messages[0]?.id ?? nestedMessages[0]?.id ?? value.messageId ?? value.message_id ?? "").trim() || undefined;
}

export function assignRegistrationNumbers(registrations: RegistrationEntry[], workshopId: string) {
  let nextNumber = registrations.reduce((highest, entry) => {
    const match = entry.registrationNumber?.match(REGISTRATION_NUMBER_PATTERN);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;

  return registrations
    .map((entry, index) => ({ entry, index }))
    .sort((first, second) => new Date(first.entry.createdAt).getTime() - new Date(second.entry.createdAt).getTime())
    .reduce((result, item) => {
      const entry = result[item.index];
      if (entry.workshopId === workshopId && entry.registrationStatus !== "waiting" && !entry.registrationNumber) {
        result[item.index] = { ...entry, registrationNumber: `REG-${String(nextNumber).padStart(4, "0")}` };
        nextNumber += 1;
      }
      return result;
    }, [...registrations]);
}

export async function sendRegistrationConfirmation(registration: RegistrationEntry, form?: Partial<BuilderForm>, workshopType?: string): Promise<WhatsAppDeliveryResult> {
  if (!form?.whatsappConfirmationEnabled || registration.registrationStatus === "waiting" || registration.confirmationWhatsappSentAt) {
    return { configured: false, sent: false };
  }

  const templateName = form.whatsappConfirmationTemplate
    || process.env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME
    || process.env.WHATSAPP_CONFIRMATION_TEMPLATE_ID;
  // The approved pre-recorded course template has one body slot: name.
  // hf_39_confirmation has two body slots; the standard confirmation
  // template has four: name, workshop, starting date, registration number.
  // The group link is static text in the approved provider template.
  const isFixedHf39Template = templateName === "hf_39_confirmation";
  const startDate = form.manualWhatsappStartDate?.trim();
  const isPreRecorded = (workshopType || "").replace(/[\s_-]+/g, "").toLowerCase() === "prerecorded";
  if (!isFixedHf39Template && !isPreRecorded && !startDate) {
    return { configured: true, sent: false, error: "Set the workshop starting date in Workshop Create / Edit before sending confirmation WhatsApp." };
  }
  const values = isFixedHf39Template
    ? [registration.fullName, registration.registrationNumber || "-"]
    : isPreRecorded
      ? [registration.fullName]
      : [registration.fullName, form.workshopName || registration.workshopTitle, `Starting from ${startDate}`, registration.registrationNumber || "-"];
  return sendTemplateMessage({
    senderId: form.whatsappSenderId,
    mobile: registration.mobile,
    name: registration.fullName,
    registrationId: registration.id,
    templateName,
    buttonValues: form.whatsappConfirmationButtonValues ?? (templateName === "hf_39_confirmation" ? ["https://shorturl.at/Wgcr4"] : undefined),
    values
  });
}

type WhatsAppDeliveryResult = { configured: boolean; error?: string; messageId?: string; sent: boolean };

async function sendTemplateMessage(input: {
  senderId?: string;
  mobile: string;
  name: string;
  registrationId?: string;
  templateName?: string;
  buttonValues?: string[];
  values: string[];
}): Promise<WhatsAppDeliveryResult> {
  let account;
  try { account = await resolveWhatsAppAccount(input.senderId); } catch { return { configured: true, sent: false, error: "Selected WhatsApp sender is unavailable." }; }
  const apiUrl = account ? account.apiUrl : process.env.WHATSAPP_CONFIRMATION_API_URL || process.env.WHATSAPP_OTP_API_URL;
  const authToken = account ? account.authToken : process.env.WHATSAPP_CONFIRMATION_AUTH_TOKEN || process.env.WHATSAPP_OTP_AUTH_TOKEN;
  if (input.buttonValues?.some(value => typeof value !== "string" || !value.trim())) return { configured: true, sent: false, error: "Enter a value for each WhatsApp template button or remove the empty button." };
  const mobileDigits = input.mobile.replace(/\D/g, "").slice(-10);
  if (!apiUrl || !authToken || !input.templateName || mobileDigits.length !== 10) {
    return { configured: false, sent: false };
  }

  const mobile = `91${mobileDigits}`;
  try {
    const response = await fetch(apiUrl, {
      body: JSON.stringify({
        authToken,
        ...(account ? { from: account.number, sender: account.number, whatsappNumber: account.number } : {}),
        data: input.values,
        language: account?.language || process.env.WHATSAPP_CONFIRMATION_LANGUAGE || "en",
        name: input.name,
        originWebsite: process.env.WHATSAPP_OTP_ORIGIN_WEBSITE || "https://coachforlife.in/",
        sendto: mobile,
        templateName: input.templateName,
        ...(input.buttonValues?.length ? { buttonValue: input.buttonValues.map(value => value.trim()), ButtonValue: input.buttonValues.map(value => value.trim()) } : {}),
        BodyDynamicData: input.values,
        Name: input.name,
        PhoneNumber: mobile,
        TemplateName: input.templateName,
        mobile,
        parameters: input.values,
        templateId: input.templateName,
        to: mobile,
        variables: input.values
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        authtoken: authToken
      },
      signal: AbortSignal.timeout(15_000),
      method: "POST"
    });
    let sent = response.ok;
    let messageId: string | undefined;
    let providerReason: string | undefined;
    try {
      const result = await response.clone().json();
      messageId = readProviderMessageId(result);
      if (typeof result?.IsSuccess === "boolean") sent = sent && result.IsSuccess;
      if (typeof result?.Status === "number") sent = sent && result.Status >= 200 && result.Status < 300;
      const reason = result?.error?.message ?? result?.ErrorMessage ?? result?.Message ?? result?.message ?? result?.error ?? result?.Error;
      if (typeof reason === "string") {
        providerReason = reason;
        for (const privateValue of [authToken, input.mobile, mobile, mobileDigits, input.name]) {
          if (privateValue) providerReason = providerReason.split(privateValue).join("[redacted]");
        }
        providerReason = providerReason.replace(/[\r\n\t]+/g, " ").slice(0, 500).trim();
      }
    } catch {
      // Successful provider responses are not guaranteed to be JSON.
    }
    const error = sent ? undefined : `WhatsApp provider returned ${response.status}.${providerReason ? ` ${providerReason}` : ""}`;
    await recordOutboundWhatsAppMessage({ providerMessageId: messageId, registrationId: input.registrationId, mobile, templateName: input.templateName, status: sent ? "sent" : "failed", error }).catch(() => undefined);
    return { configured: true, error, messageId, sent };
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : "WhatsApp delivery failed.", sent: false };
  }
}

export async function sendRegistrationStatusNotifications(registration: RegistrationEntry, form?: Partial<BuilderForm>, workshopType?: string) {
  const patch: Partial<RegistrationEntry> = {};
  if (!form?.whatsappConfirmationEnabled) return patch;
  const now = new Date().toISOString();

  if (registration.registrationStatus !== "waiting") {
    if (registration.confirmationWhatsappSentAt) return patch;
    const result = await sendRegistrationConfirmation(registration, form, workshopType);
    patch.confirmationWhatsappStatus = result.sent ? "sent" : result.configured ? "failed" : "not_configured";
    patch.confirmationWhatsappError = result.sent ? undefined : result.configured ? result.error || "WhatsApp confirmation delivery failed." : "Confirmation template or provider is not configured.";
    if (result.sent) patch.confirmationWhatsappSentAt = now;
    return patch;
  }

  if (!registration.waitingWhatsappSentAt) {
    const participantTemplate = form.whatsappWaitingTemplate
      || process.env.WHATSAPP_WAITING_TEMPLATE_NAME
      || process.env.WHATSAPP_WAITING_TEMPLATE_ID;
    const participantResult = await sendTemplateMessage({
      senderId: form.whatsappSenderId,
    mobile: registration.mobile,
      name: registration.fullName,
      registrationId: registration.id,
      templateName: participantTemplate,
      buttonValues: form.whatsappWaitingButtonValues,
      values: [
        registration.fullName,
        registration.workshopTitle,
        registration.batch || "Main Batch",
        `WL-${registration.waitingPosition || "-"}`,
        registration.waitingReason || "waiting"
      ]
    });
    patch.waitingWhatsappStatus = participantResult.sent ? "sent" : participantResult.configured ? "failed" : "not_configured";
    patch.waitingWhatsappError = participantResult.sent ? undefined : participantResult.error || "Waiting template or provider is not configured.";
    if (participantResult.sent) patch.waitingWhatsappSentAt = now;
  }

  const referenceDigits = registration.referralCode?.replace(/\D/g, "").slice(-10) || "";
  if (registration.referralCodeId && referenceDigits.length === 10 && !registration.referrerWaitingWhatsappSentAt) {
    const referrerTemplate = form.whatsappReferrerWaitingTemplate
      || process.env.WHATSAPP_REFERRER_WAITING_TEMPLATE_NAME
      || process.env.WHATSAPP_REFERRER_WAITING_TEMPLATE_ID;
    const referrerResult = await sendTemplateMessage({
      senderId: form.whatsappSenderId,
      mobile: referenceDigits,
      name: registration.referrerName || "Referrer",
      registrationId: registration.id,
      templateName: referrerTemplate,
      buttonValues: form.whatsappReferrerWaitingButtonValues,
      values: [
        registration.referrerName || "Referrer",
        registration.fullName,
        registration.mobile,
        registration.workshopTitle,
        registration.batch || "Main Batch",
        `WL-${registration.waitingPosition || "-"}`
      ]
    });
    patch.referrerWaitingWhatsappStatus = referrerResult.sent ? "sent" : referrerResult.configured ? "failed" : "not_configured";
    patch.referrerWaitingWhatsappError = referrerResult.sent ? undefined : referrerResult.error || "Referrer waiting template or provider is not configured.";
    if (referrerResult.sent) patch.referrerWaitingWhatsappSentAt = now;
  }

  return patch;
}
