import { deleteCrmClient, listCrmClients, saveCrmClient } from "@/lib/crm-db";
import { isDbEnabled } from "@/lib/db";
import { NextResponse } from "next/server";
import { dispatchCustomerWebhook } from "@/lib/integration-hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function GET(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false });
  const params = new URL(request.url).searchParams;
  try {
    const result = await listCrmClients({
      cursor: params.get("cursor"),
      limit: Number(params.get("limit") || 25),
      query: params.get("query") ?? "",
      status: params.get("status") ?? ""
    });
    return NextResponse.json({ dbEnabled: true, ...result });
  } catch {
    return NextResponse.json({ dbEnabled: true, error: "Failed to load clients." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!isObject(body) || typeof body.name !== "string" || typeof body.mobile !== "string") {
    return NextResponse.json({ error: "Client name and mobile are required." }, { status: 400 });
  }
  if (!body.name.trim() || body.mobile.replace(/\D/g, "").slice(-10).length < 10) {
    return NextResponse.json({ error: "Client name and a valid mobile are required." }, { status: 400 });
  }
  try {
    const client = await saveCrmClient({
      city: String(body.city ?? ""),
      country: String(body.country ?? "India"),
      dob: String(body.dob ?? ""),
      email: String(body.email ?? ""),
      gender: String(body.gender ?? ""),
      mobile: body.mobile,
      name: body.name,
      occupation: String(body.occupation ?? ""),
      state: String(body.state ?? ""),
      status: String(body.status ?? "Active")
    });
    await dispatchCustomerWebhook(client.created ? "customer.created" : "customer.updated", { ...body, id: client.id });
    return NextResponse.json({ client, ok: true });
  } catch (error) {
    const code = isObject(error) ? error.code : null;
    return NextResponse.json(
      { error: code === "23505" ? "A client with this mobile or identity already exists." : "Failed to save client." },
      { status: code === "23505" ? 409 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!isObject(body) || !body.id || typeof body.name !== "string" || typeof body.mobile !== "string") {
    return NextResponse.json({ error: "Client id, name and mobile are required." }, { status: 400 });
  }
  try {
    const client = await saveCrmClient({
      city: String(body.city ?? ""),
      country: String(body.country ?? "India"),
      dob: String(body.dob ?? ""),
      email: String(body.email ?? ""),
      gender: String(body.gender ?? ""),
      id: String(body.id),
      mobile: body.mobile,
      name: body.name,
      occupation: String(body.occupation ?? ""),
      state: String(body.state ?? ""),
      status: String(body.status ?? "Active")
    });
    await dispatchCustomerWebhook("customer.updated", { ...body, id: client.id });
    return NextResponse.json({ client, ok: true });
  } catch (error) {
    const code = isObject(error) ? error.code : null;
    return NextResponse.json(
      { error: code === "23505" ? "Another client already uses this mobile or identity." : "Failed to update client." },
      { status: code === "23505" ? 409 : 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false }, { status: 400 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Client id is required." }, { status: 400 });
  try {
    const deleted = await deleteCrmClient(id);
    return deleted
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Client not found." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to archive client." }, { status: 500 });
  }
}
