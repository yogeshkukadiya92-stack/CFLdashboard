import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMfwWorkshops, selectMfwWorkshopMapping } from "../lib/mfw-workshop-mapping.ts";

test("normalizes MFW event fields from a nested workshops response", () => {
  assert.deepEqual(normalizeMfwWorkshops({
    data: { workshops: [{ eventId: "hf-37", eventName: "Healthy Forever 37" }] }
  }), [{ id: "hf-37", title: "Healthy Forever 37" }]);
});

test("normalizes top-level MFW workshop name fields", () => {
  assert.deepEqual(normalizeMfwWorkshops({
    workshops: [{ id: "hf-38", name: "Healthy Forever 38" }]
  }), [{ id: "hf-38", title: "Healthy Forever 38" }]);
});

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
