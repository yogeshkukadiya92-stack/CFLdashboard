import { salesPersonCodeFromId } from "./sales-person-code.ts";
import type { SalesTeamUser } from "./types.ts";

// Login records retain the original profile ID even if an old browser snapshot
// overwrites the profile list. Recover only public fields, never credentials.
export function reconcileSalesPeople(people: unknown[], users: SalesTeamUser[]): unknown[] {
  const result = [...people];
  const ids = new Set(people.map((person) => String((person as { id?: unknown })?.id || "")));
  for (const user of users) {
    if (!user.salesPersonId || ids.has(user.salesPersonId)) continue;
    result.push({
      id: user.salesPersonId,
      salesPersonCode: salesPersonCodeFromId(user.salesPersonId),
      name: user.name, mobile: user.mobile, email: user.email,
      isActive: user.active, canViewOther: user.canViewOther,
      group: "Other", commissions: [],
      // Recovery must not invent a pause for an active login. Existing profiles
      // (including explicit pauses) are preserved above.
      acceptingLeads: user.active,
      dailyCallTarget: 50, dailyConnectedTarget: 20
    });
    ids.add(user.salesPersonId);
  }
  return result;
}
