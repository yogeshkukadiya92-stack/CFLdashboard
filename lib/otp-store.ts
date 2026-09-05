import { createHmac } from "node:crypto";
import { getDbPool } from "./db";
let schema: Promise<unknown> | undefined;
async function database() {
  const db=getDbPool();
  if(!db) throw new Error("Database is required for shared OTP verification");
  schema ??= db.query(`DO $setup$ BEGIN PERFORM pg_advisory_xact_lock(73184,3); CREATE TABLE IF NOT EXISTS cfl_otp_challenges (
    mobile TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  ); END $setup$;`).catch(error=>{schema=undefined;throw error;});
  await schema; return db;
}
function hash(mobile: string, code: string) {
  const secret=process.env.AUTH_SECRET;
  if(!secret) throw new Error("AUTH_SECRET required for OTP storage");
  return createHmac("sha256",secret).update(`${mobile}:${code}`).digest("hex");
}
export async function saveOtp(mobile:string,code:string,ttlMs:number) {
  const db=await database();
  await db.query(`INSERT INTO cfl_otp_challenges(mobile,code_hash,expires_at,attempts) VALUES($1,$2,$3,0)
    ON CONFLICT(mobile) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0`,[mobile,hash(mobile,code),new Date(Date.now()+ttlMs)]);
}
export async function clearOtp(mobile:string,code?:string) {
  const db=await database();
  await db.query("DELETE FROM cfl_otp_challenges WHERE mobile=$1 AND ($2::text IS NULL OR code_hash=$2)",[mobile,code?hash(mobile,code):null]);
}
export async function verifyStoredOtp(mobile:string,code:string):Promise<"ok"|"expired"|"locked"|"incorrect"> {
  const db=await database(), client=await db.connect();
  try {
    await client.query("BEGIN");
    const row=(await client.query("SELECT code_hash,expires_at,attempts FROM cfl_otp_challenges WHERE mobile=$1 FOR UPDATE",[mobile])).rows[0];
    let result: "ok"|"expired"|"locked"|"incorrect";
    if(!row||new Date(row.expires_at).getTime()<=Date.now()) result="expired";
    else if(row.attempts>=5) result="locked";
    else result=row.code_hash===hash(mobile,code)?"ok":"incorrect";
    if(result==="incorrect") await client.query("UPDATE cfl_otp_challenges SET attempts=attempts+1 WHERE mobile=$1",[mobile]);
    else await client.query("DELETE FROM cfl_otp_challenges WHERE mobile=$1",[mobile]);
    await client.query("COMMIT"); return result;
  } catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
}
