import assert from "node:assert/strict";
import test from "node:test";
import { beginPersistenceTransaction, isMissingPersistenceTableError, reserveRegistrationNumber } from "./db.ts";

test("only a missing app_state table triggers schema initialization on read", () => {
  assert.equal(isMissingPersistenceTableError({ code: "42P01" }), true);
  assert.equal(isMissingPersistenceTableError({ code: "55P03" }), false);
  assert.equal(isMissingPersistenceTableError(new Error("connection timed out")), false);
});

test("registration transactions skip schema DDL when app_state already exists", async () => {
  const queries: string[] = [];
  let initializationCount = 0;
  const client = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [{ registrations: [] }] };
    }
  };

  const result = await beginPersistenceTransaction(
    client as never,
    "SELECT registrations FROM app_state FOR UPDATE",
    async () => { initializationCount += 1; }
  );

  assert.equal(initializationCount, 0);
  assert.deepEqual(queries, ["BEGIN", "SELECT registrations FROM app_state FOR UPDATE"]);
  assert.deepEqual(result.rows, [{ registrations: [] }]);
});

test("registration transactions initialize once when app_state is missing", async () => {
  const queries: string[] = [];
  let initializationCount = 0;
  let selectCount = 0;
  const client = {
    async query(sql: string) {
      queries.push(sql);
      if (sql.startsWith("SELECT") && selectCount++ === 0) {
        throw Object.assign(new Error("relation app_state does not exist"), { code: "42P01" });
      }
      return { rows: [{ registrations: [] }] };
    }
  };

  const result = await beginPersistenceTransaction(
    client as never,
    "SELECT registrations FROM app_state FOR UPDATE",
    async () => { initializationCount += 1; }
  );

  assert.equal(initializationCount, 1);
  assert.deepEqual(queries, [
    "BEGIN",
    "SELECT registrations FROM app_state FOR UPDATE",
    "ROLLBACK",
    "BEGIN",
    "SELECT registrations FROM app_state FOR UPDATE"
  ]);
  assert.deepEqual(result.rows, [{ registrations: [] }]);
});

test("registration numbers are reserved atomically and keep the public format", async () => {
  let query = "";
  const client = {
    async query(sql: string) {
      query = sql;
      return { rows: [{ value: "724" }] };
    }
  };

  assert.equal(await reserveRegistrationNumber(client as never), "REG-0724");
  assert.match(query, /ON CONFLICT \(scope\) DO UPDATE/);
  assert.match(query, /cfl_registration_counters\.value \+ 1/);
  assert.doesNotMatch(query, /cfl_registration_records/);
});
