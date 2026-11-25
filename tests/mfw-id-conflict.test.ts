import assert from "node:assert/strict";
import test from "node:test";
import { hasMfwRegistrationIdConflict } from "../lib/mfw-id-conflict.ts";

const entry = {
  registrationNumber: "REG-23069",
  mfwSyncStatus: "failed",
  mfwSyncError: "Unique ID REG-23069 is already assigned to Existing Person (1111111111). This row matches Other Person (2222222222). Verify the REG ID or mobile number."
};

test("manual retry can replace an ID explicitly owned by another MFW person", () => {
  assert.equal(hasMfwRegistrationIdConflict(entry), true);
});

test("never replace IDs for other errors, stale conflicts or successful enrollments", () => {
  assert.equal(hasMfwRegistrationIdConflict({ ...entry, mfwSyncError: "Request timed out" }), false);
  assert.equal(hasMfwRegistrationIdConflict({ ...entry, registrationNumber: "REG-23070" }), false);
  assert.equal(hasMfwRegistrationIdConflict({ ...entry, mfwSyncStatus: "synced" }), false);
  assert.equal(hasMfwRegistrationIdConflict({ ...entry, mfwSyncError: "Unique ID REG-23069 is already assigned to someone" }), false);
  assert.equal(hasMfwRegistrationIdConflict({ ...entry, registrationNumber: undefined }), false);
});
