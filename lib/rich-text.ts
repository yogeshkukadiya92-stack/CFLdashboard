const allowedTags = new Set(["br", "p", "div", "span", "strong", "b", "em", "i", "u", "ul", "ol", "li"]);
const colorPattern = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*\)|rgba\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(0|1|0?\.\d+)\s*\)|[a-z]+)$/i;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeColor(value: string) {
  const color = value.trim().replace(/["']/g, "");
  return colorPattern.test(color) ? color : "";
}

function sanitizeAttributes(rawAttributes: string) {
  const colorFromFont = rawAttributes.match(/\scolor=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const colorFromStyle = rawAttributes.match(/\sstyle=(?:"[^"]*color\s*:\s*([^;"]+)|'[^']*color\s*:\s*([^;']+)|[^\s>]*color\s*:\s*([^;\s>]+))/i);
  const color = sanitizeColor(colorFromFont?.[1] ?? colorFromFont?.[2] ?? colorFromFont?.[3] ?? colorFromStyle?.[1] ?? colorFromStyle?.[2] ?? colorFromStyle?.[3] ?? "");
  return color ? ` style="color: ${color}"` : "";
}

export function sanitizeRichTextHtml(value: string) {
  if (!value.trim()) return "";

  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  if (!hasHtml) {
    return escapeHtml(value).replace(/\r?\n/g, "<br />");
  }

  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1>/gi, "")
    .replace(/<font\b([^>]*)>/gi, (_, attrs: string) => `<span${sanitizeAttributes(attrs)}>`)
    .replace(/<\/font>/gi, "</span>")
    .replace(/<([a-z0-9]+)\b([^>]*)>/gi, (match, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!allowedTags.has(tag)) return "";
      if (tag === "br") return "<br />";
      return `<${tag}${tag === "span" ? sanitizeAttributes(attrs) : ""}>`;
    })
    .replace(/<\/([a-z0-9]+)>/gi, (match, rawTag: string) => {
      const tag = rawTag.toLowerCase();
      if (!allowedTags.has(tag) || tag === "br") return "";
      return `</${tag}>`;
    });
}
