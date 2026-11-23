import test from "node:test";
import assert from "node:assert/strict";
import { latestBirthdate, validBirthdate, isBirthdateField, hasInvalidBirthdateAnswer } from "../lib/birthdate.ts";
const today = new Date("2026-11-23T10:00:00Z");
test("birthdate requires a real date and at least twelve completed years", () => {
  assert.equal(latestBirthdate(today), "2014-11-23");
  for (const value of ["2014-11-23", "1992-02-29"]) assert.equal(validBirthdate(value, today), true);
  for (const value of ["", "2014-11-24", "2026-01-01", "1993-02-29", "2000-04-31", "2000--12"]) assert.equal(validBirthdate(value, today), false);
});
test("cutoff uses India date and handles leap day", () => {
  assert.equal(latestBirthdate(new Date("2026-11-22T19:00:00Z")), "2014-11-23");
  assert.equal(latestBirthdate(new Date("2012-02-29T10:00:00Z")), "2000-02-29");
});
test("recognizes birthdate labels without constraining other dates", () => {
  for (const label of ["Date of Birth", "Birthdate", "DOB", "D.O.B.", "જન્મ તારીખ", "जन्म तिथि"]) assert.equal(isBirthdateField({ label }), true);
  assert.equal(isBirthdateField({ label: "Session date" }), false);
  assert.equal(hasInvalidBirthdateAnswer({ Birthdate: "2026-01-01" }), true);
  assert.equal(hasInvalidBirthdateAnswer({ Birthdate: "", "Session date": "2026-01-01" }), false);
});
