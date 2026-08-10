import type { BuilderForm, RegistrationEntry } from "@/lib/types";

const REGISTRATION_NUMBER_PATTERN = /^REG-(\d+)$/i;

export function assignRegistrationNumbers(registrations: RegistrationEntry[], workshopId: string) {
  let nextNumber = registrations.reduce((highest, entry) => {
    if (entry.workshopId !== workshopId) return highest;
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
  try {
    const result = await response.clone().json();
    if (typeof result?.IsSuccess === "boolean") sent = result.IsSuccess;
    if (typeof result?.Status === "number") sent = sent && result.Status >= 200 && result.Status < 300;
  } catch {
    // Successful 11za responses are not guaranteed to be JSON.
  }
  return { configured: true, sent };
}
