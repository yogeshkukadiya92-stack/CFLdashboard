import type { BuilderForm, RegistrationEntry } from "@/lib/types";
import { recordOutboundWhatsAppMessage } from "./whatsapp-automation.ts";

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

export async function sendRegistrationConfirmation(registration: RegistrationEntry, form?: Partial<BuilderForm>) {
  if (!form?.whatsappConfirmationEnabled || registration.registrationStatus === "waiting" || registration.confirmationWhatsappSentAt) {
    return { configured: false, sent: false };
  }

  const apiUrl = process.env.WHATSAPP_CONFIRMATION_API_URL || process.env.WHATSAPP_OTP_API_URL;
  const authToken = process.env.WHATSAPP_CONFIRMATION_AUTH_TOKEN || process.env.WHATSAPP_OTP_AUTH_TOKEN;
  const templateName = form.whatsappConfirmationTemplate
    || process.env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME
    || process.env.WHATSAPP_CONFIRMATION_TEMPLATE_ID;
  if (!apiUrl || !authToken || !templateName) return { configured: false, sent: false };

  const mobile = `91${registration.mobile.replace(/\D/g, "").slice(-10)}`;
  const groupUrl = form.whatsappGroupUrl?.trim() || "-";
  const values = [registration.fullName, registration.workshopTitle, registration.registrationNumber || "-", groupUrl];
  const response = await fetch(apiUrl, {
    body: JSON.stringify({
      authToken,
      data: values,
      language: process.env.WHATSAPP_CONFIRMATION_LANGUAGE || "en",
      name: registration.fullName,
      originWebsite: process.env.WHATSAPP_OTP_ORIGIN_WEBSITE || "https://coachforlife.in/",
      sendto: mobile,
      templateName,
      BodyDynamicData: values,
      Name: registration.fullName,
      PhoneNumber: mobile,
      TemplateName: templateName,
      mobile,
      parameters: values,
      templateId: templateName,
      to: mobile,
      variables: values
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      authtoken: authToken
    },
    method: "POST"
  });

  let sent = response.ok;
  let messageId: string | undefined;
  try {
    const result = await response.clone().json();
    messageId = readProviderMessageId(result);
    if (typeof result?.IsSuccess === "boolean") sent = result.IsSuccess;
    if (typeof result?.Status === "number") sent = sent && result.Status >= 200 && result.Status < 300;
  } catch {
    // Successful 11za responses are not guaranteed to be JSON.
  }
  await recordOutboundWhatsAppMessage({ providerMessageId: messageId, registrationId: registration.id, mobile, templateName, status: sent ? "sent" : "failed", error: sent ? undefined : `Provider returned HTTP ${response.status}` }).catch(() => undefined);
  return { configured: true, sent };
}

type WhatsAppDeliveryResult = { configured: boolean; error?: string; messageId?: string; sent: boolean };

async function sendTemplateMessage(input: {
  mobile: string;
  name: string;
  registrationId?: string;
  templateName?: string;
  values: string[];
}): Promise<WhatsAppDeliveryResult> {
  const apiUrl = process.env.WHATSAPP_CONFIRMATION_API_URL || process.env.WHATSAPP_OTP_API_URL;
  const authToken = process.env.WHATSAPP_CONFIRMATION_AUTH_TOKEN || process.env.WHATSAPP_OTP_AUTH_TOKEN;
  const mobileDigits = input.mobile.replace(/\D/g, "").slice(-10);
  if (!apiUrl || !authToken || !input.templateName || mobileDigits.length !== 10) {
    return { configured: false, sent: false };
  }

  const mobile = `91${mobileDigits}`;
  try {
    const response = await fetch(apiUrl, {
      body: JSON.stringify({
        authToken,
        data: input.values,
        language: process.env.WHATSAPP_CONFIRMATION_LANGUAGE || "en",
        name: input.name,
        originWebsite: process.env.WHATSAPP_OTP_ORIGIN_WEBSITE || "https://coachforlife.in/",
        sendto: mobile,
        templateName: input.templateName,
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
      method: "POST"
    });
    let sent = response.ok;
    let messageId: string | undefined;
    try {
      const result = await response.clone().json();
      messageId = readProviderMessageId(result);
      if (typeof result?.IsSuccess === "boolean") sent = result.IsSuccess;
      if (typeof result?.Status === "number") sent = sent && result.Status >= 200 && result.Status < 300;
    } catch {
      // Successful provider responses are not guaranteed to be JSON.
    }
    const error = sent ? undefined : `WhatsApp provider returned ${response.status}.`;
    await recordOutboundWhatsAppMessage({ providerMessageId: messageId, registrationId: input.registrationId, mobile, templateName: input.templateName, status: sent ? "sent" : "failed", error }).catch(() => undefined);
    return { configured: true, error, messageId, sent };
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : "WhatsApp delivery failed.", sent: false };
  }
}

export async function sendRegistrationStatusNotifications(registration: RegistrationEntry, form?: Partial<BuilderForm>) {
  const patch: Partial<RegistrationEntry> = {};
  if (!form?.whatsappConfirmationEnabled) return patch;
  const now = new Date().toISOString();

  if (registration.registrationStatus !== "waiting") {
    if (registration.confirmationWhatsappSentAt) return patch;
    const result = await sendRegistrationConfirmation(registration, form);
    patch.confirmationWhatsappStatus = result.sent ? "sent" : result.configured ? "failed" : "not_configured";
    patch.confirmationWhatsappError = result.sent ? undefined : result.configured ? "WhatsApp confirmation delivery failed." : "Confirmation template or provider is not configured.";
    if (result.sent) patch.confirmationWhatsappSentAt = now;
    return patch;
  }

  if (!registration.waitingWhatsappSentAt) {
    const participantTemplate = form.whatsappWaitingTemplate
      || process.env.WHATSAPP_WAITING_TEMPLATE_NAME
      || process.env.WHATSAPP_WAITING_TEMPLATE_ID;
    const participantResult = await sendTemplateMessage({
      mobile: registration.mobile,
      name: registration.fullName,
      registrationId: registration.id,
      templateName: participantTemplate,
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
      mobile: referenceDigits,
      name: registration.referrerName || "Referrer",
      registrationId: registration.id,
      templateName: referrerTemplate,
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
