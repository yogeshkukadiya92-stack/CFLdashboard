import assert from "node:assert/strict";
import test from "node:test";
import { selectPublicRegistrationConfig } from "../lib/public-registration-config.ts";

test("public link loads only its workshop and forms, preserving settings and hiding referral codes", () => {
  const state = {
    registrationLinks: { "r-test": { id: "hf39", slug: "r-test", published: false, otpRequired: false }, other: { id: "other" } },
    workshops: [{ id: "hf39", name: "HF 39", minimumPartPayment: 500 }, { id: "other", name: "Other" }],
    forms: [{ workshopId: "hf39", workshopSlug: "hf-39", fields: [{ id: "name" }], otpRequired: true, referralCodes: [{ code: "private" }] }, { workshopId: "other" }]
  };
  const result = selectPublicRegistrationConfig(state, "r-test");
  assert.deepEqual(result.registrationLinks, { "r-test": state.registrationLinks["r-test"] });
  assert.deepEqual(result.workshops, [state.workshops[0]]);
  assert.equal(result.forms.length, 1);
  assert.equal(result.forms[0].otpRequired, true);
  assert.deepEqual(result.forms[0].fields, [{ id: "name" }]);
  assert.equal("referralCodes" in result.forms[0], false);
  assert.ok(state.forms[0].referralCodes);
});

test("workshop-name, explicit workshop id, and standalone form links still resolve", () => {
  const state = { workshops: [{ id: "w1", name: "Healthy Forever 39" }], forms: [{ workshopId: "w1" }, { workshopSlug: "standalone" }] };
  assert.equal(selectPublicRegistrationConfig(state, "healthy-forever-39").forms.length, 1);
  assert.equal(selectPublicRegistrationConfig(state, "custom", "w1").workshops.length, 1);
  assert.equal(selectPublicRegistrationConfig(state, "standalone").forms.length, 1);
  assert.deepEqual(selectPublicRegistrationConfig(state, "missing").forms, []);
});
