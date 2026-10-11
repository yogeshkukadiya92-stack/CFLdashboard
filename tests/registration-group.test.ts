import assert from "node:assert/strict";
import test from "node:test";
import { resolveRegistrationGroupUrl } from "../lib/registration-group.ts";

const registration = { formId: "form-1", id: "workshop-1", slug: "intro-39" };
const invite = "https://chat.whatsapp.com/current?mode=gi_t";

test("legacy simple links use the saved workshop group invite", () => {
  assert.equal(resolveRegistrationGroupUrl([{ id: "saved", workshopId: "workshop-1", whatsappGroupUrl: invite }], registration), invite);
});

test("embedded snapshots use the current invite and respect removal", () => {
  const old = { ...registration, whatsappGroupUrl: "https://chat.whatsapp.com/old" };
  assert.equal(resolveRegistrationGroupUrl([{ id: "form-1", whatsappGroupUrl: invite }], old), invite);
  assert.equal(resolveRegistrationGroupUrl([{ id: "form-1" }], old), undefined);
  assert.equal(resolveRegistrationGroupUrl([], old), old.whatsappGroupUrl);
});

test("exact form identity wins over slug matches and unrelated forms", () => {
  const forms = [{ id: "other", workshopSlug: "intro-39", whatsappGroupUrl: "wrong" }, { id: "form-1", whatsappGroupUrl: ` ${invite} ` }];
  assert.equal(resolveRegistrationGroupUrl(forms, registration), invite);
  assert.equal(resolveRegistrationGroupUrl([forms[0]], { ...registration, slug: "different" }), undefined);
  assert.equal(resolveRegistrationGroupUrl([forms[0]], registration), "wrong");
});
