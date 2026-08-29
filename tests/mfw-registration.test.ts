import assert from "node:assert/strict";
import test from "node:test";
import { selectMfwWorkshopMapping } from "../lib/mfw-workshop-mapping.ts";

test("uses an enabled workshop-specific MFW mapping", () => {
  assert.deepEqual(selectMfwWorkshopMapping({
    mfwEnrollmentEnabled: true,
    mfwWorkshopEventId: "mfw-event-42",
    mfwWorkshopTitle: "Healthy Forever"
  }, "legacy-event"), {
    title: "Healthy Forever",
    workshopEventId: "mfw-event-42"
  });
});

test("does not enroll when workshop integration is disabled", () => {
  assert.equal(selectMfwWorkshopMapping({
    mfwEnrollmentEnabled: false,
    mfwWorkshopEventId: "mfw-event-42"
  }), null);
});

test("keeps an enabled workshop without a selection detectable as invalid", () => {
  assert.deepEqual(selectMfwWorkshopMapping({ mfwEnrollmentEnabled: true }), {
    title: "",
    workshopEventId: ""
  });
});

test("keeps the legacy environment mapping as a fallback", () => {
  assert.deepEqual(selectMfwWorkshopMapping(undefined, "legacy-event"), {
    title: "",
    workshopEventId: "legacy-event"
  });
});
