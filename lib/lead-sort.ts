/** Return records newest first without mutating the stored order. */
export function newestFirstByCreatedAt<T extends { createdAt?: string }>(leads: readonly T[]): T[] {
  const timestamp = (value?: string) => {
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : -Infinity;
  };
  return [...leads].sort((a, b) => {
    const first = timestamp(a.createdAt);
    const second = timestamp(b.createdAt);
    return first === second ? 0 : first > second ? -1 : 1;
  });
}
