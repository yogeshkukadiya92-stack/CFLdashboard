import { NextResponse } from "next/server";

type OtpRecord = {
  attempts: number;
  code: string;
  expiresAt: number;
};

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_STORE = (globalThis as unknown as { __cflOtpStore?: Map<string, OtpRecord> }).__cflOtpStore ?? new Map<string, OtpRecord>();
(globalThis as unknown as { __cflOtpStore?: Map<string, OtpRecord> }).__cflOtpStore = OTP_STORE;

function cleanMobile(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendWhatsAppOtp(mobile: string, code: string) {
  const directApiUrl = process.env.WHATSAPP_OTP_API_URL;
  const directAuthToken = process.env.WHATSAPP_OTP_AUTH_TOKEN;
  const directTemplate = process.env.WHATSAPP_OTP_TEMPLATE_NAME || process.env.WHATSAPP_OTP_TEMPLATE_ID;
  if (directApiUrl && directAuthToken && directTemplate) {
    const recipient = `91${mobile}`;
    const originWebsite = process.env.WHATSAPP_OTP_ORIGIN_WEBSITE || "https://coachforlife.in/";
    const senderNumber = process.env.WHATSAPP_OTP_NUMBER || "916353531533";
    const language = process.env.WHATSAPP_OTP_LANGUAGE || "en";
    const payload = {
      authToken: directAuthToken,
      data: [code],
      language,
      name: "Participant",
      originWebsite,
      sendto: recipient,
      templateName: directTemplate,
      ...(process.env.WHATSAPP_OTP_BUTTON_VALUE ? { buttonValue: process.env.WHATSAPP_OTP_BUTTON_VALUE } : {}),
      ...(process.env.WHATSAPP_OTP_HEADER_DATA ? { headerdata: process.env.WHATSAPP_OTP_HEADER_DATA } : {}),
      ...(process.env.WHATSAPP_OTP_TAGS ? { tags: process.env.WHATSAPP_OTP_TAGS } : {}),
      // Backward-compatible aliases for providers or webhooks using different field names.
      BodyDynamicData: [code],
      ButtonValue: process.env.WHATSAPP_OTP_BUTTON_VALUE,
      HeaderDynamicData: process.env.WHATSAPP_OTP_HEADER_DATA,
      Language: language,
      Name: "Participant",
      PhoneNumber: recipient,
      Tags: process.env.WHATSAPP_OTP_TAGS,
      TemplateName: directTemplate,
      bodyValues: [code],
      code,
      from: senderNumber,
      mobile: recipient,
      mobileNumber: recipient,
      otp: code,
      parameters: [code],
      phone: recipient,
      sender: senderNumber,
      templateId: directTemplate,
      to: recipient,
      ttlSeconds: OTP_TTL_MS / 1000,
      variables: [code],
      whatsappNumber: senderNumber
    };
    const response = await fetch(directApiUrl, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${directAuthToken}`,
        authtoken: directAuthToken
      },
      method: "POST"
    });
    let sent = response.ok;
    let providerMessage = "";
    try {
      const result = await response.clone().json();
      if (typeof result?.IsSuccess === "boolean") sent = result.IsSuccess;
      if (typeof result?.Status === "number") sent = sent && result.Status >= 200 && result.Status < 300;
      providerMessage = String(result?.Message || result?.message || result?.Error || result?.error || "");
    } catch {
      // Some providers return plain text for successful sends.
      providerMessage = await response.clone().text().catch(() => "");
    }
    if (!sent) {
      console.error("WhatsApp OTP provider failed", {
        mobileLast4: mobile.slice(-4),
        providerMessage,
        status: response.status
      });
    }
    return { configured: true, sent, providerMessage };
  }

  const webhookUrl = process.env.WHATSAPP_OTP_WEBHOOK_URL;
  const webhookToken = process.env.WHATSAPP_OTP_WEBHOOK_TOKEN;
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      body: JSON.stringify({
        channel: "whatsapp",
        code,
        mobile: `91${mobile}`,
        ttlSeconds: OTP_TTL_MS / 1000
      }),
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {})
      },
      method: "POST"
    });
    return { configured: true, sent: response.ok };
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_WHATSAPP_OTP_TEMPLATE_ID || process.env.MSG91_OTP_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) return { configured: false, sent: false };

  const response = await fetch("https://control.msg91.com/api/v5/otp", {
    body: JSON.stringify({
      mobile: `91${mobile}`,
      otp: code,
      template_id: templateId
    }),
    headers: {
      "Content-Type": "application/json",
      authkey: authKey
    },
    method: "POST"
  });
  return { configured: true, sent: response.ok };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mobile = cleanMobile(body?.mobile);
    if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
      return NextResponse.json({ error: "Valid 10-digit mobile number is required." }, { status: 400 });
    }

    const code = createOtp();
    OTP_STORE.set(mobile, { attempts: 0, code, expiresAt: Date.now() + OTP_TTL_MS });
    const whatsapp = await sendWhatsAppOtp(mobile, code);
    if (!whatsapp.configured && process.env.NODE_ENV === "production") {
      OTP_STORE.delete(mobile);
      return NextResponse.json({ error: "WhatsApp OTP service is not configured. Please contact admin or use a non-OTP form." }, { status: 503 });
    }
    if (whatsapp.configured && !whatsapp.sent) {
      OTP_STORE.delete(mobile);
      return NextResponse.json({ error: "Could not send WhatsApp OTP. Please try again." }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      expiresInSeconds: OTP_TTL_MS / 1000,
      ...(whatsapp.configured ? {} : { setupOtp: code })
    });
  } catch {
    return NextResponse.json({ error: "Could not send WhatsApp OTP. Please try again." }, { status: 500 });
  }
}
