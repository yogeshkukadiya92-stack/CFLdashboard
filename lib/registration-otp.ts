export function resolveRegistrationOtpRequired(
  linkSetting: boolean | undefined,
  formSetting: boolean | undefined
) {
  return linkSetting ?? formSetting ?? false;
}
