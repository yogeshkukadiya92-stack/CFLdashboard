import assert from "node:assert/strict";
import test from "node:test";
import { validateBackupRecords } from "../lib/callflow-backup-records.ts";

const note = {table:"notes",id:"note-a",updatedAt:100,row:{id:"note-a",leadId:null,callId:"call-log-123",body:"Call tomorrow"}};
test("account backup accepts call notes without an assigned lead or UUID call id", () => {
  assert.deepEqual(validateBackupRecords([note]),[note]);
});
test("backup validates every record before database writes and excludes credential tables", () => {
  assert.throws(() => validateBackupRecords([note,{...note,table:"users"}]));
  assert.throws(() => validateBackupRecords([{...note,id:"different-id"}]));
  assert.throws(() => validateBackupRecords([{...note,row:{...note.row,body:{secret:"object"}}}]));
});
test("backup batches and individual records have bounded sizes", () => {
  assert.throws(() => validateBackupRecords(Array.from({length:101},()=>note)));
  assert.throws(() => validateBackupRecords([{...note,row:{...note.row,body:"x".repeat(70000)}}]));
  assert.throws(() => validateBackupRecords([{...note,updatedAt:-1}]));
});
