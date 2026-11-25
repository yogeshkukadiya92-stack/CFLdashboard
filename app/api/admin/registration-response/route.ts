import { ensurePersistenceTable, ensureRegistrationRecordsTable, getDbPool } from "@/lib/db";
import { internationalPhone, registrationPhoneKey } from "@/lib/phone-number";
import { registrationUtmFields } from "@/lib/registration-utm";
import type { RegistrationEntry } from "@/lib/types";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const id = body?.registrationId;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const mobile = body?.mobile === undefined ? undefined : internationalPhone(body.mobile);
  if (typeof id !== "string" || !id.trim() || !fullName || mobile === "") {
    return NextResponse.json({ error: "Enter a name and a valid mobile number. Include the country code for international numbers." }, { status: 400 });
  }

  const submittedAnswers = body.answers;
  if (!submittedAnswers || typeof submittedAnswers !== "object" || Array.isArray(submittedAnswers)
    || Object.values(submittedAnswers).some((value) => typeof value !== "string")) {
    return NextResponse.json({ error: "Invalid response answers." }, { status: 400 });
  }
  const reservedLabels = new Set<string>(["Registration Type", ...registrationUtmFields.map(([, label]) => label)]);
  const answers = Object.fromEntries(Object.entries(submittedAnswers).filter(([label]) => !reservedLabels.has(label)));

  const database = getDbPool();
  if (!database) return NextResponse.json({ error: "Database is unavailable." }, { status: 503 });

  try {
    await ensurePersistenceTable();
    await ensureRegistrationRecordsTable();
    const result = await database.query<{ payload: RegistrationEntry }>(`
      UPDATE cfl_registration_records
      SET payload = payload || jsonb_build_object('fullName', $2::text)
        || CASE WHEN $3::text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('mobile', $3::text) END
        || CASE WHEN $4::text IS NOT NULL AND mobile_normalized <> $4
                AND payload->>'whatsappVerificationStatus' = 'verified'
                THEN '{"whatsappVerificationStatus":"not_verified"}'::jsonb ELSE '{}'::jsonb END
        || CASE WHEN jsonb_typeof(payload->'answers') = 'object'
                THEN jsonb_build_object('answers', (payload->'answers') || (
                  SELECT COALESCE(jsonb_object_agg(answer.key, answer.value), '{}'::jsonb)
                  FROM jsonb_each($5::jsonb) AS answer
                  WHERE (payload->'answers') ? answer.key
                )) ELSE '{}'::jsonb END,
        mobile_normalized = COALESCE($4::text, mobile_normalized),
        updated_at = NOW()
      WHERE external_id = $1
      RETURNING payload
    `, [id, fullName, mobile ?? null, mobile ? registrationPhoneKey(mobile) : null, JSON.stringify(answers)]);

    const registration = result.rows[0]?.payload;
    if (!registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    return NextResponse.json({ registration });
  } catch {
    return NextResponse.json({ error: "Could not save the registration response. Please try again." }, { status: 500 });
  }
}
