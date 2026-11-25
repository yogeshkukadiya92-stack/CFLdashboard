import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { medicalAnswerError } from "../lib/medical-form-fields.ts";

test("conditional medical questions only require visible answers", () => {
  const fields = [
    {
      key: "height",
      label: "Height",
      type: "NUMBER",
      required: true,
      options: [],
      dataTarget: "BODY_HEIGHT",
      validation: { min: 50, max: 300 },
      logic: { sourceKey: "needed", value: "yes" },
    },
  ];
  assert.equal(medicalAnswerError(fields, {}), "");
  assert.match(medicalAnswerError(fields, { needed: "yes" }), /Height/);
  assert.match(
    medicalAnswerError(fields, { needed: "yes", height: "999" }),
    /Height/
  );
  assert.equal(
    medicalAnswerError(fields, { needed: "yes", height: "165" }),
    ""
  );
});

for (const scenario of [
  "confirmed",
  "full",
  "already booked",
  "waiting",
  "replay",
]) {
  test("medical booking worker: " + scenario, async () => {
    const calls: string[] = [];
    const sql: string[] = [];
    const row = {
      workshop: "cfl",
      event: "mfw",
      registration_id: "reg",
      state: "pending",
      token: "share",
      key: "draft",
      slot: "morning",
      answers: { phone: "incorrect" },
      receipt: scenario === "replay" ? { id: "receipt" } : null,
    };
    const client = {
      query: async (q: string) => {
        sql.push(q);
        return { rows: [row] };
      },
      release() {},
    };
    const db = { query: async () => ({}), connect: async () => client };
    async function fetchMock(_url: string, options: RequestInit) {
      const { query, variables } = JSON.parse(String(options.body));
      if (query.startsWith("query"))
        return Response.json({
          data: {
            form: {
              eventId: "mfw",
              fields: [{ key: "phone", dataTarget: "USER_MOBILE" }],
              appointments: { enabled: true },
            },
            slots: [],
          },
        });
      if (query.includes("submitMy")) {
        calls.push("response");
        assert.equal(variables.answers.phone, "9876543210");
        assert.equal(variables.id, "draft");
        return Response.json({ data: { result: { id: "response" } } });
      }
      calls.push("appointment");
      assert.equal(variables.response, "response");
      if (scenario === "full" || scenario === "already booked")
        return Response.json({
          errors: [{ message: "This appointment slot is " + scenario }],
        });
      return Response.json({
        data: { result: { id: "booking", startsAt: "2026-11-26T04:00:00Z" } },
      });
    }
    const source = readFileSync(
      new URL("../lib/mfw-medical.ts", import.meta.url),
      "utf8"
    );
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const worker = {} as {
      completeMedicalBooking: (r: unknown) => Promise<void>;
    };
    new Function("require", "exports", "fetch", "process", compiled)(
      (name: string) => (name === "./db" ? { getDbPool: () => db } : {}),
      worker,
      fetchMock,
      { env: { MFW_GRAPHQL_URL: "https://example.test/graphql" } }
    );
    await worker.completeMedicalBooking({
      id: "reg",
      workshopId: "cfl",
      mobile: "+919876543210",
      medicalBookingKey: "draft",
      registrationStatus: scenario === "waiting" ? "waiting" : "confirmed",
      mfwSyncStatus: "synced",
      mfwWorkshopEventId: "mfw",
    });
    assert.deepEqual(
      calls,
      scenario === "waiting" || scenario === "replay"
        ? []
        : ["response", "appointment"]
    );
    if (scenario !== "waiting") assert.equal(sql.at(-1), "COMMIT");
    if (scenario === "confirmed" || scenario === "replay")
      assert.ok(sql.some((s) => s.includes("medicalBookingReceipt")));
    if (scenario === "full" || scenario === "already booked")
      assert.ok(sql.some((s) => s.includes("medicalBookingState")));
  });
}
