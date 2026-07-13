export function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

export function currentOrigin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function buildRegistrationUrl(input: { baseUrl?: string; query?: string; slug: string }) {
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? "") || currentOrigin();
  const path = `/register/${input.slug}`;
  return `${baseUrl}${path}${input.query ? `?${input.query.replace(/^\?/, "")}` : ""}`;
}
