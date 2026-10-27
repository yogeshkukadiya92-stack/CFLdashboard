import { internationalPhone } from "./phone-number.ts";
import type { BuilderForm, RegistrationEntry } from './types.ts';

export const DEFAULT_MANUAL_WHATSAPP_TEMPLATE = `Hello {{name}}

आपका Healthy Forever - Commitment workshop *Registration Confirm* हो गया है। ✅

🎯 *{{workshop_name}}*
📅 *Starting from {{start_date}}*

Registration No.: *{{registration_no}}*

*Please join this WhatsApp Group:*
{{whatsapp_group_link}}

Thank you,
- Team Healthy Forever | Coach For Life`;

export function renderManualWhatsApp(entry: RegistrationEntry, form?: Partial<BuilderForm>) {
  const values: Record<string, string> = {
    name: entry.fullName,
    workshop_name: form?.workshopName || entry.workshopTitle,
    start_date: form?.manualWhatsappStartDate || '',
    registration_no: entry.registrationNumber || '',
    whatsapp_group_link: form?.whatsappGroupUrl || ''
  };
  return (form?.manualWhatsappTemplate || DEFAULT_MANUAL_WHATSAPP_TEMPLATE).replace(/{{\s*([a-z_]+)\s*}}/g, (match, key: string) => values[key] ?? match);
}

export function manualWhatsAppUrl(mobile: string, message: string) {
  const number = internationalPhone(mobile);
  if (!number) return null;
  const digits = number.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
