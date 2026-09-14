import { createHmac } from "node:crypto";

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET required for workshop OTP fallback");
  return value;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export function createWorkshopOtpFallbackHash(formId: string, code: string) {
  if (!formId.trim() || !/^\d{6}$/.test(code)) throw new Error("Valid form and 6-digit fallback OTP required");
  return createHmac("sha256", secret()).update(`workshop-otp:${formId}:${code}`).digest("hex");
}

export function verifyWorkshopOtpFallbackHash(formId: string, code: string, configuredHash?: string) {
  const hash = String(configuredHash ?? "").trim();
  if (!/^[a-f0-9]{64}$/i.test(hash) || !/^\d{6}$/.test(code)) return false;
  return constantTimeEqual(createWorkshopOtpFallbackHash(formId, code), hash.toLowerCase());
}
