type GroupForm = { id: string; workshopId?: string; workshopSlug?: string; whatsappGroupUrl?: string };

// Shared links can contain an older form snapshot. The saved form owns the
// current invite, including an intentionally removed invite.
export function resolveRegistrationGroupUrl(
  forms: GroupForm[],
  registration: { formId: string; id: string; slug: string; whatsappGroupUrl?: string }
) {
  const saved = forms.find((form) => form.id === registration.formId)
    ?? forms.find((form) => form.workshopId === registration.id)
    ?? forms.find((form) => form.workshopSlug === registration.slug);
  return (saved ? saved.whatsappGroupUrl : registration.whatsappGroupUrl)?.trim() || undefined;
}
