export const featureGroups = {
  "Workshop setup": ["MFW", "Pricing & CRM", "PAW sync"],
  "Registration form": ["Basics", "Fields", "Included", "Preview", "Form analytics"],
  Automation: ["WhatsApp invite", "Status messages", "OTP verification", "Attendance confirmation", "Waiting list", "Repeater rules"]
};
export const features = Object.values(featureGroups).flat();
export type TagPolicy = { name: string; disabled: string[] };
export function primaryTag(tag: string) {
  return tag.split(",")[0].trim().toLowerCase();
}
