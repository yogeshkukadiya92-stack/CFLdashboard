type ResponseIdentityOptions<T> = {
  email?: (item: T) => string | undefined;
  mobile?: (item: T) => string | undefined;
  name?: (item: T) => string | undefined;
  scope?: (item: T) => string | undefined;
  submittedAt?: (item: T) => string | undefined;
};

function normalizedText(value?: string) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function identityKey<T>(item: T, options: ResponseIdentityOptions<T>, index: number) {
  const scope = normalizedText(options.scope?.(item)) || "all";
  const mobile = String(options.mobile?.(item) ?? "").replace(/\D/g, "").slice(-10);
  if (mobile.length === 10) return `${scope}|mobile:${mobile}`;
  const email = normalizedText(options.email?.(item));
  if (email.includes("@")) return `${scope}|email:${email}`;
  const name = normalizedText(options.name?.(item));
  return name ? `${scope}|name:${name}` : `${scope}|row:${index}`;
}

export function hideDuplicateResponses<T>(items: T[], options: ResponseIdentityOptions<T>) {
  const newest = new Map<string, { index: number; timestamp: number }>();
  items.forEach((item, index) => {
    const key = identityKey(item, options, index);
    const parsed = Date.parse(options.submittedAt?.(item) ?? "");
    const timestamp = Number.isNaN(parsed) ? -index : parsed;
    const current = newest.get(key);
    if (!current || timestamp > current.timestamp) newest.set(key, { index, timestamp });
  });
  const retained = new Set(Array.from(newest.values(), (value) => value.index));
  return items.filter((_, index) => retained.has(index));
}
