import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDbPool } from "./db.ts";

export type WhatsAppAccount = { id: string; label: string; number: string; apiUrl: string; authToken: string; otpTemplate: string; language: string };
const file = path.join(process.cwd(), ".data", "whatsapp-accounts.json");
async function database() {
  const db = getDbPool();
  if (db) await db.query("CREATE TABLE IF NOT EXISTS cfl_whatsapp_accounts (id TEXT PRIMARY KEY, payload JSONB NOT NULL)");
  return db;
}
export async function getWhatsAppAccounts(): Promise<WhatsAppAccount[]> {
  const db = await database();
  if (db) return (await db.query("SELECT payload FROM cfl_whatsapp_accounts ORDER BY id")).rows.map(row => row.payload);
  try { return JSON.parse(await readFile(file, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
export async function saveWhatsAppAccount(account: WhatsAppAccount) {
  const db = await database();
  if (db) { await db.query("INSERT INTO cfl_whatsapp_accounts (id,payload) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload", [account.id, JSON.stringify(account)]); return; }
  const accounts = await getWhatsAppAccounts();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify([...accounts.filter(item => item.id !== account.id), account]), { mode: 0o600 });
}
export async function resolveWhatsAppAccount(id?: string) {
  if (!id) return undefined;
  const account = (await getWhatsAppAccounts()).find(item => item.id === id);
  if (!account) throw new Error("Selected WhatsApp number is unavailable. Update the workshop sender.");
  return account;
}
