type ManualOtpOverrideInput = {
  configuredCode?: string;
  isAdmin: boolean;
  submittedCode: string;
};

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export function canUseManualOtpOverride({ configuredCode, isAdmin, submittedCode }: ManualOtpOverrideInput) {
  const code = String(configuredCode ?? "").trim();
  return isAdmin && /^\d{6}$/.test(code) && constantTimeEqual(code, submittedCode);
}
