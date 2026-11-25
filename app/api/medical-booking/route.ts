import { medicalAnswerError } from "@/lib/medical-form-fields";
import { drainRegistrationJobs } from "@/lib/registration-jobs";
import { after, NextResponse } from "next/server";
import {
  medicalDb,
  medicalForm,
  medicalKey,
  medicalMapping,
} from "@/lib/mfw-medical";

export async function GET(req: Request) {
  try {
    const mapping = await medicalMapping(
      new URL(req.url).searchParams.get("workshop") || ""
    );
    return NextResponse.json(mapping ? await medicalForm(mapping) : null);
  } catch {
    return NextResponse.json(
      { error: "Could not load the MFW medical form." },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body.secret !== "string" || !/^[a-f0-9-]{36}$/.test(body.secret))
      return new Response(null, { status: 400 });
    const db = await medicalDb();
    const key = medicalKey(body.secret);
    if (body.action === "prepare") {
      if (
        typeof body.registrationId !== "string" ||
        !body.registrationId ||
        body.registrationId.length > 300
      )
        return new Response(null, { status: 400 });
      const mapping = await medicalMapping(body.workshop);
      if (!mapping) return new Response(null, { status: 404 });
      const form = await medicalForm(mapping);
      if (!form.slots.some((slot) => slot.id === body.slot))
        return NextResponse.json(
          { error: "Please select an available slot." },
          { status: 409 }
        );
      if (
        !body.answers ||
        typeof body.answers !== "object" ||
        Array.isArray(body.answers) ||
        JSON.stringify(body.answers).length > 64000
      )
        return new Response(null, { status: 400 });
      const invalid = medicalAnswerError(form.fields, body.answers);
      if (invalid)
        return NextResponse.json({ error: invalid }, { status: 400 });
      await db.query(
        "INSERT INTO cfl_medical_bookings(key,workshop,event,token,answers,slot,registration_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(key) DO NOTHING",
        [
          key,
          body.workshop,
          mapping.event,
          mapping.token,
          body.answers,
          body.slot,
          body.registrationId,
        ]
      );
      return NextResponse.json({ key });
    }
    if (body.action === "reselect") {
      const {
        rows: [row],
      } = await db.query(
        "SELECT token,event FROM cfl_medical_bookings WHERE key=$1 AND state='choose_slot'",
        [key]
      );
      if (!row) return new Response(null, { status: 409 });
      const form = await medicalForm(row);
      if (!form.slots.some((slot) => slot.id === body.slot))
        return NextResponse.json(
          { error: "Slot unavailable." },
          { status: 409 }
        );
      await db.query(
        `WITH changed AS (
        UPDATE cfl_medical_bookings SET slot=$2,state='pending' WHERE key=$1 AND state='choose_slot' RETURNING registration_id
      ) INSERT INTO cfl_registration_jobs(registration_id) SELECT registration_id FROM changed
        ON CONFLICT(registration_id) DO UPDATE SET completed_at=NULL, available_at=now(), attempts=0,
        revision=cfl_registration_jobs.revision+1`,
        [key, body.slot]
      );
      after(() => drainRegistrationJobs());
    }
    const {
      rows: [row],
    } = await db.query(
      "SELECT state,receipt,token,event FROM cfl_medical_bookings WHERE key=$1",
      [key]
    );
    if (!row) return new Response(null, { status: 404 });
    return NextResponse.json({
      state: row.state,
      receipt: row.receipt,
      slots: row.state === "choose_slot" ? (await medicalForm(row)).slots : [],
    });
  } catch {
    return NextResponse.json(
      { error: "MFW booking is unavailable. Please try again." },
      { status: 503 }
    );
  }
}
