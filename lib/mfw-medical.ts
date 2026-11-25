import type { MedicalField } from "./medical-form-fields";
import { createHash } from "node:crypto";
import { getDbPool } from "./db";
import type { RegistrationEntry } from "./types";

export const medicalKey = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const url =
    process.env.MFW_GRAPHQL_URL ||
    new URL("/graphql", process.env.MFW_API_BASE_URL).href;
  const result = await fetch(url, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await result.json();
  if (!result.ok || body.errors?.length || !body.data)
    throw new Error(body.errors?.[0]?.message || "MFW is unavailable.");
  return body.data;
}

export async function medicalMapping(workshopId: string, database: Pick<import("pg").PoolClient, "query"> = getDbPool()!) {
  const result = await database.query(
    "SELECT w FROM app_state, jsonb_array_elements(workshops) w WHERE id=1 AND w->>'id'=$1",
    [workshopId]
  );
  const workshop = result.rows[0]?.w;
  if (!workshop?.mfwEnrollmentEnabled || !workshop.mfwMedicalFormToken)
    return null;
  return {
    token: String(workshop.mfwMedicalFormToken),
    event: String(workshop.mfwWorkshopEventId),
  };
}

export type MedicalSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  remainingCount: number;
};
export async function availableMedicalSlots(mapping: { token: string; event: string }) {
  const data = await graphql<{form: {eventId: string}; slots: MedicalSlot[]}>(
    "query($token:String!){form:getMyHealthyForeverWorkshopForm(token:$token){eventId} slots:getMyHealthyForeverWorkshopAppointmentSlots(token:$token){id startsAt endsAt available remainingCount}}",
    {token: mapping.token}
  );
  if (data.form?.eventId !== mapping.event) throw new Error("Medical workshop mismatch.");
  return data.slots.filter(slot => slot.available);
}

export async function medicalForm(mapping: { token: string; event: string }) {
  const data = await graphql<{
    form: {
      eventId: string;
      fields: MedicalField[];
      title: string;
      publicAccess: { mobileFieldKey?: string };
      appointments: { enabled: boolean };
    };
    slots: MedicalSlot[];
  }>(
    "query($token:String!){form:getMyHealthyForeverWorkshopForm(token:$token){eventId title publicAccess appointments fields{key label type required options dataTarget logic validation}} slots:getMyHealthyForeverWorkshopAppointmentSlots(token:$token){id startsAt endsAt available remainingCount}}",
    { token: mapping.token }
  );
  if (data.form.eventId !== mapping.event || !data.form.appointments?.enabled)
    throw new Error(
      "Select a published appointment form from the mapped MFW workshop."
    );
  return {
    title: data.form.title,
    fields: data.form.fields,
    mobileKey: data.form.publicAccess?.mobileFieldKey,
    slots: data.slots.filter((slot) => slot.available),
  };
}

let schema: Promise<unknown> | undefined;
export async function medicalDb() {
  const db = getDbPool()!;
  schema ??= db
    .query(
      `DO $setup$ BEGIN
    PERFORM pg_advisory_xact_lock(73184, 18);
    CREATE TABLE IF NOT EXISTS cfl_medical_bookings (
    key text PRIMARY KEY, workshop text NOT NULL, token text NOT NULL, event text NOT NULL, answers jsonb NOT NULL,
    slot text NOT NULL, response_id text, receipt jsonb, state text NOT NULL DEFAULT 'pending', registration_id text, created_at timestamptz DEFAULT now()); END $setup$`
    )
    .catch((error) => {
      schema = undefined;
      throw error;
    });
  await schema;
  return db;
}

export async function completeMedicalBooking(reg: RegistrationEntry) {
  if (
    !reg.medicalBookingKey ||
    reg.registrationStatus !== "confirmed" ||
    reg.mfwSyncStatus !== "synced"
  )
    return;
  const db = await medicalDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const {
      rows: [row],
    } = await client.query(
      "SELECT * FROM cfl_medical_bookings WHERE key=$1 AND workshop=$2 AND event=$3 FOR UPDATE",
      [reg.medicalBookingKey, reg.workshopId, reg.mfwWorkshopEventId]
    );
    if (!row || (row.registration_id && row.registration_id !== reg.id))
      throw new Error("Medical booking does not match registration.");
    if (row.state === "choose_slot" || row.state === "review") {
      await client.query("COMMIT");
      return;
    }
    const token = row.token;
    let receipt = row.receipt;
    if (!receipt) {
      const form = await medicalForm({ token, event: row.event });
      const answers = { ...row.answers };
      for (const field of form.fields) {
        if (field.dataTarget === "USER_MOBILE" || field.key === form.mobileKey)
          answers[field.key] = /^\+?91\d{10}$/.test(reg.mobile)
            ? reg.mobile.slice(-10)
            : reg.mobile;
      }
      const responseId =
        row.response_id ||
        (
          await graphql<{ result: { id: string } }>(
            'mutation($token:String!,$answers:JSON!,$id:String!){result:submitMyHealthyForeverWorkshopForm(token:$token,answers:$answers,clientSubmissionId:$id,source:"CFL"){id}}',
            { token, answers, id: row.key }
          )
        ).result.id;
      await client.query(
        "UPDATE cfl_medical_bookings SET response_id=$2, registration_id=$3 WHERE key=$1",
        [row.key, responseId, reg.id]
      );
      try {
        receipt = (
          await graphql<{
            result: { id: string; startsAt: string; endsAt: string };
          }>(
            "mutation($token:String!,$slot:ID!,$response:ID!){result:bookMyHealthyForeverWorkshopAppointment(token:$token,slotId:$slot,responseId:$response){id startsAt endsAt}}",
            { token, slot: row.slot, response: responseId }
          )
        ).result;
      } catch (error) {
        const message = String(error);
        const state = /already booked/i.test(message)
          ? "review"
          : /slot.*(full|closed|started|unavailable)|booking.*closed/i.test(
              message
            )
          ? "choose_slot"
          : "";
        if (!state) throw error;
        await client.query(
          "UPDATE cfl_medical_bookings SET state=$2 WHERE key=$1",
          [row.key, state]
        );
        await client.query(
          "UPDATE cfl_registration_records SET payload=payload || jsonb_build_object('medicalBookingState',$2::text) WHERE external_id=$1",
          [reg.id, state]
        );
        await client.query("COMMIT");
        return;
      }
      await client.query(
        "UPDATE cfl_medical_bookings SET receipt=$2,state='booked',answers='{}' WHERE key=$1",
        [row.key, receipt]
      );
    }
    await client.query(
      "UPDATE cfl_registration_records SET payload=payload || jsonb_build_object('medicalBookingReceipt',$2::jsonb) WHERE external_id=$1",
      [reg.id, receipt]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
