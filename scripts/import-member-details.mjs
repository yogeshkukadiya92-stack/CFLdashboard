import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const extractorPath = path.join(scriptDirectory, "extract-member-details.py");
const args = parseArgs(process.argv.slice(2));
const filePath = path.resolve(String(args.file || ""));
const python = String(args.python || process.env.PYTHON || "python3");
const batchSize = Math.min(1000, Math.max(100, Number(args["batch-size"] || 500)));
const dryRun = Boolean(args["dry-run"]);
const appUrl = String(args["app-url"] || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

if (!args.file) {
  throw new Error("Usage: npm run import:members -- --file /path/Member-details.xlsx [--dry-run]");
}
await access(filePath);
await access(extractorPath);

const [sourceHash, expectedRows] = await Promise.all([
  hashFile(filePath),
  countRows(python, filePath)
]);

if (dryRun) {
  const summary = await validateFile(python, filePath);
  process.stdout.write(`${JSON.stringify({ sourceHash, expectedRows, ...summary }, null, 2)}\n`);
  process.exit(0);
}

const email = process.env.CFL_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
const password = process.env.CFL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error("Set CFL_ADMIN_EMAIL and CFL_ADMIN_PASSWORD before running the live import.");
}

const cookie = await login(appUrl, email, password);
const start = await apiRequest(appUrl, cookie, {
  action: "start",
  expectedRows,
  metadata: {
    batchSize,
    facilitatorAlias: { "LUV PATEL": "Dr Luv Patel" },
    statusMapping: { P: "Failed", R: "Refund", S: "Success" }
  },
  sourceFile: path.basename(filePath),
  sourceHash
});
const run = start.run;
if (!run?.id) throw new Error("Import API did not return a run id.");
if (run.status === "complete" && run.processedRows === expectedRows) {
  process.stdout.write(`Import already complete for this file (${expectedRows.toLocaleString("en-IN")} rows).\n`);
  process.exit(0);
}

let batch = [];
let batchesSent = 0;
let rowsSent = Number(run.processedRows || 0);
const skipThroughSourceRow = rowsSent + 1;

for await (const raw of streamRawRows(python, filePath)) {
  if (raw.source_row <= skipThroughSourceRow) continue;
  batch.push(normalizeRow(raw));
  if (batch.length < batchSize) continue;
  await sendBatchWithRetry(appUrl, cookie, run.id, batch);
  rowsSent += batch.length;
  batchesSent += 1;
  batch = [];
  if (batchesSent % 10 === 0 || rowsSent === expectedRows) {
    process.stdout.write(`Imported ${rowsSent.toLocaleString("en-IN")} / ${expectedRows.toLocaleString("en-IN")} rows\n`);
  }
}

if (batch.length) {
  await sendBatchWithRetry(appUrl, cookie, run.id, batch);
  rowsSent += batch.length;
}

const finished = await apiRequest(appUrl, cookie, { action: "finish", runId: run.id });
process.stdout.write(`${JSON.stringify({ runId: run.id, rowsSent, summary: finished.summary }, null, 2)}\n`);

function parseArgs(input) {
  const parsed = {};
  for (let index = 0; index < input.length; index += 1) {
    const token = input[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = input[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

async function hashFile(inputPath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(inputPath)) hash.update(chunk);
  return hash.digest("hex");
}

async function countRows(pythonBinary, inputPath) {
  const child = spawn(pythonBinary, [extractorPath, inputPath, "--count"], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  let errors = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { errors += chunk; });
  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  if (exitCode !== 0) throw new Error(errors || "Failed to count workbook rows.");
  return Number(JSON.parse(output).rows);
}

async function* streamRawRows(pythonBinary, inputPath) {
  const child = spawn(pythonBinary, [extractorPath, inputPath], { stdio: ["ignore", "pipe", "pipe"] });
  let errors = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { errors += chunk; });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line);
  }
  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  if (exitCode !== 0) throw new Error(errors || "Workbook extraction failed.");
}

function tidy(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function canonicalText(value) {
  return tidy(value).normalize("NFKC").toLocaleLowerCase("en-IN");
}

function normalizeMobile(value) {
  let digits = tidy(value).replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(-10);
  return digits;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseDate(value) {
  const match = tidy(value).match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+\d{2}:\d{2}:\d{2})?$/);
  if (!match) throw new Error(`Unsupported registration date: ${value}`);
  return `${match[3]}-${match[2]}-${match[1]}T00:00:00+05:30`;
}

function normalizeRow(raw) {
  const name = tidy(raw.name);
  const mobileRaw = tidy(raw.mobileno);
  const mobileNormalized = normalizeMobile(mobileRaw);
  const hasTenDigitMobile = mobileNormalized.length === 10;
  const isValidMobile = mobileNormalized.length === 10 && /^[6-9]/.test(mobileNormalized);
  const email = tidy(raw.emailid);
  const normalizedEmail = canonicalText(email);
  const city = tidy(raw.cityname);
  const identityKey = hasTenDigitMobile
    ? `m:${mobileNormalized}`
    : validEmail(normalizedEmail)
      ? `e:${normalizedEmail}`
      : `n:${canonicalText(name)}|${canonicalText(city)}`;
  const workshopSourceName = tidy(raw.workshopname);
  const batchMatch = workshopSourceName.match(/^(.*)\s+-\s+(\d+)$/u);
  const workshopBaseName = tidy(batchMatch?.[1] || workshopSourceName);
  const facilitatorOriginal = tidy(raw.fname);
  const rawFacilitatorKey = canonicalText(facilitatorOriginal).replace(/\./g, "");
  const facilitatorName = rawFacilitatorKey === "luv patel" ? "Dr Luv Patel" : facilitatorOriginal;
  const facilitatorNormalized = canonicalText(facilitatorName).replace(/\./g, "");
  const statusCode = tidy(raw.status).toUpperCase();
  const statusMapping = { S: "Success", P: "Failed", R: "Refund" };
  const status = statusMapping[statusCode];
  if (!status) throw new Error(`Unknown status code ${statusCode} on source row ${raw.source_row}`);
  const payload = {
    name,
    mobileno: mobileRaw,
    emailid: email,
    regdate: tidy(raw.regdate),
    workshopname: workshopSourceName,
    status: statusCode,
    salesperson: tidy(raw.salesperson),
    statename: tidy(raw.statename),
    cityname: city,
    countryname: tidy(raw.countryname),
    fname: facilitatorOriginal,
    occupation: tidy(raw.occupation)
  };
  const rowHash = createHash("sha256")
    .update(JSON.stringify(Object.values(payload).map(canonicalText)))
    .digest("hex");

  return {
    source_row: Number(raw.source_row),
    name,
    mobile_raw: mobileRaw,
    mobile_normalized: mobileNormalized,
    valid_mobile: isValidMobile,
    identity_key: identityKey,
    email,
    registered_at: parseDate(raw.regdate),
    workshop_source_name: workshopSourceName,
    workshop_normalized: canonicalText(workshopSourceName),
    workshop_base_name: workshopBaseName,
    workshop_base_normalized: canonicalText(workshopBaseName),
    batch_label: batchMatch?.[2] || null,
    batch_number: batchMatch ? Number(batchMatch[2]) : null,
    facilitator_original: facilitatorOriginal,
    facilitator_name: facilitatorName,
    facilitator_normalized: facilitatorNormalized,
    status_code: statusCode,
    status,
    salesperson: payload.salesperson,
    state: payload.statename,
    city,
    country: payload.countryname || "India",
    occupation: payload.occupation,
    row_hash: rowHash,
    payload
  };
}

async function validateFile(pythonBinary, inputPath) {
  const workshops = new Set();
  const masters = new Set();
  const facilitators = new Set();
  const clients = new Set();
  const rowHashes = new Set();
  const statuses = { Failed: 0, Refund: 0, Success: 0 };
  let rows = 0;
  let duplicateRows = 0;
  let invalidMobiles = 0;
  let missingNames = 0;
  for await (const raw of streamRawRows(pythonBinary, inputPath)) {
    const row = normalizeRow(raw);
    rows += 1;
    if (!row.valid_mobile) invalidMobiles += 1;
    if (!row.name) missingNames += 1;
    workshops.add(row.workshop_normalized);
    masters.add(row.workshop_base_normalized);
    facilitators.add(row.facilitator_normalized);
    clients.add(row.identity_key);
    if (rowHashes.has(row.row_hash)) duplicateRows += 1;
    else rowHashes.add(row.row_hash);
    statuses[row.status] += 1;
  }
  return {
    facilitators: facilitators.size,
    clients: clients.size,
    duplicateRows,
    invalidMobiles,
    missingNames,
    rows,
    statuses,
    workshopBatches: workshops.size,
    workshopMasters: masters.size
  };
}

async function login(baseUrl, adminEmail, adminPassword) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    redirect: "manual"
  });
  if (!response.ok) throw new Error(`Admin login failed (${response.status}).`);
  const setCookie = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()[0]
    : response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Admin login did not return a session cookie.");
  return setCookie.split(";", 1)[0];
}

async function apiRequest(baseUrl, cookie, payload) {
  const response = await fetch(`${baseUrl}/api/legacy-import`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json", Cookie: cookie },
    method: "POST"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Import API failed (${response.status}).`);
  return data;
}

async function sendBatchWithRetry(baseUrl, cookie, runId, rows) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await apiRequest(baseUrl, cookie, { action: "batch", rows, runId });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}
