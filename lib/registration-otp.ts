export function resolveRegistrationOtpRequired(
  linkSetting: boolean | undefined,
  formSetting: boolean | undefined
) {
  // Both editors save OTP to the form. Link copies can outlive later form edits.
  return formSetting ?? linkSetting ?? false;
}
