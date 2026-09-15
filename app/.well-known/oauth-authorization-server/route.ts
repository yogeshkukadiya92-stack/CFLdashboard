import { oauthMetadata } from "../../../lib/mcp-oauth.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  try { return Response.json(oauthMetadata(), { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } }); }
  catch { return Response.json({ error: "temporarily_unavailable" }, { status: 503 }); }
}
