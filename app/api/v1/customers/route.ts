import { NextResponse } from "next/server";
import { isDbEnabled } from "@/lib/db";
import { listCrmClients, saveCrmClient } from "@/lib/crm-db";
import { authenticateApiKey, dispatchCustomerWebhook } from "@/lib/integration-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return response;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: Request) {
  if (!(await isDbEnabled())) return cors(NextResponse.json({ error: "Service unavailable." }, { status: 503 }));
  const key = await authenticateApiKey(request, "customers:read");
  if (!key) return cors(NextResponse.json({ error: "Invalid API key or missing customers:read scope." }, { status: 401 }));
  const params = new URL(request.url).searchParams;
  try {
    const result = await listCrmClients({
      cursor: params.get("cursor"),
      limit: Number(params.get("limit") || 25),
      query: params.get("query") ?? "",
      status: params.get("status") ?? ""
    });
    return cors(NextResponse.json({ data: result.clients, meta: { hasMore: result.hasMore, nextCursor: result.nextCursor, total: result.total } }));
  } catch {
    return cors(NextResponse.json({ error: "Could not load customers." }, { status: 500 }));
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) return cors(NextResponse.json({ error: "Service unavailable." }, { status: 503 }));
  const key = await authenticateApiKey(request, "customers:write");
  if (!key) return cors(NextResponse.json({ error: "Invalid API key or missing customers:write scope." }, { status: 401 }));
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  const mobile = String(body?.mobile ?? "").trim();
  if (!name || mobile.replace(/\D/g, "").slice(-10).length !== 10) {
    return cors(NextResponse.json({ error: "name and a valid 10-digit mobile are required." }, { status: 422 }));
  }
  try {
    const saved = await saveCrmClient({
      city: String(body?.city ?? ""),
      country: String(body?.country ?? "India"),
      dob: String(body?.dob ?? ""),
      email: String(body?.email ?? ""),
      gender: String(body?.gender ?? ""),
      mobile,
      name,
      occupation: String(body?.occupation ?? ""),
      state: String(body?.state ?? ""),
      status: String(body?.status ?? "Active")
    });
    const customer = { ...body, id: saved.id, mobile, name };
    await dispatchCustomerWebhook(saved.created ? "customer.created" : "customer.updated", customer);
    return cors(NextResponse.json({ data: customer, event: saved.created ? "customer.created" : "customer.updated" }, { status: saved.created ? 201 : 200 }));
  } catch {
    return cors(NextResponse.json({ error: "Could not save customer." }, { status: 500 }));
  }
}
