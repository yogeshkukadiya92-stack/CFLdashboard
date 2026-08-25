import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { getAppState } from "@/lib/db";

export async function GET(request: NextRequest) {
  const identity = readCallFlowBearer(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getAppState(); if (!state) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const person = (Array.isArray(state.salesPeople) ? state.salesPeople : []).find((item: unknown) => String((item as { id?: unknown })?.id) === identity.salesPersonId) as { whatsappTemplate?: unknown } | undefined;
  if (!person) return NextResponse.json({ error: "Salesperson profile not found" }, { status: 404 });
  const fallback = "Hi {{leadName}}, thank you for speaking with Coach For Life. Please reply here if you need any help.";
  return NextResponse.json({ whatsappTemplate: String(person.whatsappTemplate || fallback).slice(0, 500), salespersonName: identity.name });
}
