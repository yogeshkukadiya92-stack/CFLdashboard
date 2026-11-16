import type { RegistrationEntry } from "./types.ts";

/** Promote the seat as well as the follow-up status before numbering or notifying. */
export function promoteConfirmedRegistration(entry: RegistrationEntry): RegistrationEntry {
  return {
    ...entry,
    registrationStatus: "confirmed",
    waitingPosition: undefined,
    waitingReason: undefined
  };
}

export function isWaitingRegistration(entry: RegistrationEntry): boolean {
  return entry.registrationStatus === "waiting" && entry.confirmationStatus !== "confirmed";
}
