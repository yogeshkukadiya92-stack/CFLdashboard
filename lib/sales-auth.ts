import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import type { SalesTeamUser } from "@/lib/types";

function secret() {
  const value = process.env.SALES_AUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("SALES_AUTH_SECRET or AUTH_SECRET must be configured.");
  return "cfl-local-sales-secret-change-before-production";
}
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("hex"); }
function equal(a: string, b: string) { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
export function hashSalesPassword(password: string, identity: string) { return scryptSync(password, sign(`sales-password:${identity.trim().toLowerCase()}`), 64).toString("hex"); }
export function verifySalesPassword(password: string, user: SalesTeamUser) { return equal(hashSalesPassword(password, user.mobile), user.passwordHash); }
