import { getDbPool } from "@/lib/db";
import type { BuilderForm } from "@/lib/types";

// OTP requests need one form, not the full dashboard and registration history.
export async function getOtpForm(formId: string): Promise<BuilderForm | undefined> {
  const db = getDbPool();
  if (!db) return undefined;
  const result = await db.query(
    "SELECT form FROM app_state, jsonb_array_elements(forms) AS form WHERE app_state.id=1 AND form->>'id'=$1 LIMIT 1",
    [formId]
  );
  return result.rows[0]?.form as BuilderForm | undefined;
}
