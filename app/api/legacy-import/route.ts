import {
  finishLegacyImport,
  getLegacyImportRun,
  importLegacyBatch,
  startLegacyImport,
  type LegacyImportRow
} from "@/lib/crm-db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validImportRow(value: unknown): value is LegacyImportRow {
  if (!isObject(value)) return false;
  const statusCode = String(value.status_code);
  const expectedStatus = statusCode === "S" ? "Success" : statusCode === "P" ? "Failed" : statusCode === "R" ? "Refund" : "";
  return (
    Number.isInteger(value.source_row) && Number(value.source_row) > 1 &&
    typeof value.name === "string" && value.name.length <= 500 &&
    typeof value.mobile_raw === "string" &&
    typeof value.mobile_normalized === "string" &&
    typeof value.valid_mobile === "boolean" &&
    typeof value.identity_key === "string" &&
    typeof value.email === "string" &&
    typeof value.registered_at === "string" &&
    typeof value.workshop_source_name === "string" &&
    typeof value.workshop_normalized === "string" &&
    typeof value.workshop_base_name === "string" &&
    typeof value.workshop_base_normalized === "string" &&
    (value.batch_label === null || typeof value.batch_label === "string") &&
    (value.batch_number === null || Number.isInteger(value.batch_number)) &&
    typeof value.facilitator_original === "string" &&
    typeof value.facilitator_name === "string" &&
    typeof value.facilitator_normalized === "string" &&
    expectedStatus === value.status &&
    typeof value.salesperson === "string" &&
    typeof value.state === "string" &&
    typeof value.city === "string" &&
    typeof value.country === "string" &&
    typeof value.occupation === "string" &&
    /^[a-f0-9]{64}$/.test(String(value.row_hash)) &&
    isObject(value.payload) && JSON.stringify(value.payload).length <= 20_000
  );
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Legacy import failed.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId is required." }, { status: 400 });
  try {
    const run = await getLegacyImportRun(runId);
    return run
      ? NextResponse.json({ run })
      : NextResponse.json({ error: "Import run not found." }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isObject(body)) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  try {
    if (body.action === "start") {
      const expectedRows = Number(body.expectedRows);
      const sourceFile = typeof body.sourceFile === "string" ? body.sourceFile.trim() : "";
      const sourceHash = typeof body.sourceHash === "string" ? body.sourceHash.trim().toLowerCase() : "";
      if (!sourceFile || !Number.isInteger(expectedRows) || expectedRows < 1 || expectedRows > 2_000_000) {
        return NextResponse.json({ error: "Valid sourceFile and expectedRows are required." }, { status: 400 });
      }
      if (!/^[a-f0-9]{64}$/.test(sourceHash)) {
        return NextResponse.json({ error: "sourceHash must be a SHA-256 hash." }, { status: 400 });
      }
      const run = await startLegacyImport({
        expectedRows,
        metadata: isObject(body.metadata) ? body.metadata : undefined,
        sourceFile,
        sourceHash
      });
      return NextResponse.json({ ok: true, run });
    }

    if (body.action === "batch") {
      const runId = typeof body.runId === "string" || typeof body.runId === "number" ? String(body.runId) : "";
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!runId || rows.length === 0 || rows.length > 1000 || !rows.every(validImportRow)) {
        return NextResponse.json({ error: "Invalid runId or import rows." }, { status: 400 });
      }
      const result = await importLegacyBatch(runId, rows);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "finish") {
      const runId = typeof body.runId === "string" || typeof body.runId === "number" ? String(body.runId) : "";
      if (!runId) return NextResponse.json({ error: "runId is required." }, { status: 400 });
      const summary = await finishLegacyImport(runId);
      return NextResponse.json({ ok: true, summary });
    }

    return NextResponse.json({ error: "Unknown import action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
