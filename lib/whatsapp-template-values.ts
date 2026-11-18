export function renderTemplateValues(values: string[], context: Record<string, string>) {
  return values.map((value, index) => {
    if (typeof value !== "string") throw new Error(`Body variable ${index + 1} must be text.`);
    const rendered = value.replace(/{{\s*([^{}]+?)\s*}}/g, (_, key: string) => {
      if (!Object.hasOwn(context, key) || !context[key]?.trim()) throw new Error(`Set a value for {{${key}}} in WhatsApp template body variable ${index + 1}.`);
      return context[key];
    }).trim();
    if (!rendered || /{{|}}/.test(rendered)) throw new Error(`Enter a valid value for WhatsApp template body variable ${index + 1}.`);
    return rendered;
  });
}
