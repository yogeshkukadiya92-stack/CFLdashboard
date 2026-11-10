import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type CallFlowIdentity = {
  userId: string;
  salesPersonId: string;
  name: string;
  tenantId?: string;
  sessionId?: string;
  deviceId?: string;
};

type TokenPayload = CallFlowIdentity & { type: "access" | "refresh"; exp: number };

function secret() {
  const value = process.env.CALLFLOW_AUTH_SECRET?.trim() || process.env.SALES_AUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("CALLFLOW_AUTH_SECRET, SALES_AUTH_SECRET, or AUTH_SECRET must be configured.");
  return "cfl-local-callflow-secret-change-before-production";
}

function encode(value: string) { return Buffer.from(value).toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }
function equal(a: string, b: string) { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }

export function createCallFlowToken(identity: CallFlowIdentity, type: TokenPayload["type"], lifetimeSeconds: number) {
  const payload = encode(JSON.stringify({ ...identity, type, exp: Date.now() + lifetimeSeconds * 1000 } satisfies TokenPayload));
  return `${payload}.${sign(`callflow:${payload}`)}`;
}

export function readCallFlowToken(value: string | undefined, expectedType: TokenPayload["type"]): CallFlowIdentity | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !equal(sign(`callflow:${payload}`), signature)) return null;
  try {
    const data = JSON.parse(decode(payload)) as TokenPayload;
    if (data.type !== expectedType || data.exp <= Date.now() || !data.userId || !data.salesPersonId) return null;
    return { userId: data.userId, salesPersonId: data.salesPersonId, name: data.name, tenantId: data.tenantId, sessionId: data.sessionId, deviceId: data.deviceId };
  } catch { return null; }
}

export async function readCallFlowBearer(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const identity = readCallFlowToken(header.match(/^Bearer\s+(.+)$/i)?.[1], "access");
  if (!identity) return null;
  if (!identity.sessionId) return identity;
  const { centralSessionIsActive } = await import("./callflow-central-session.ts");
  return await centralSessionIsActive(identity) ? identity : null;
}
