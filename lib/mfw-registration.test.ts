import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./mfw-registration.ts", import.meta.url), "utf8");

test("CFL registration number is required before MFW enrollment", () => {
  assert.match(source, /if \(!registration\.registrationNumber\) throw new Error\("Registration number is required/);
});

test("CFL registration number is sent to MFW and verified as its unique ID", () => {
  assert.match(source, /registrationNumber: registration\.registrationNumber/);
  assert.match(source, /participant\.uniqueId !== registration\.registrationNumber/);
});
