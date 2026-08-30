export type BulkAttendanceParseResult = {
  invalid: string[];
  mobiles: string[];
};

export function parseBulkAttendanceMobiles(value: string, limit = 1000): BulkAttendanceParseResult {
  const mobiles: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  const values = value.split(/[,;\t\n]+/).map((item) => item.trim()).filter(Boolean);

  values.forEach((raw) => {
    if (mobiles.length >= limit) return;
    const digits = raw.replace(/\D/g, "");
    const mobile = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      invalid.push(raw);
      return;
    }
    if (!seen.has(mobile)) {
      seen.add(mobile);
      mobiles.push(mobile);
    }
  });

  return { invalid, mobiles };
}
