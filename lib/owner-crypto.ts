import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${digest.toString("hex")}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [scheme, saltHex, digestHex] = encoded.split(":");
  if (scheme !== "scrypt" || !/^[a-f0-9]{32}$/i.test(saltHex || "") || !/^[a-f0-9]{128}$/i.test(digestHex || "")) return false;
  const expected = Buffer.from(digestHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of value.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    const index = alphabet.indexOf(char);
    if (index < 0) return Buffer.alloc(0);
    bits += index.toString(2).padStart(5, "0");
  }
  return Buffer.from((bits.match(/.{8}/g) || []).map((byte) => Number.parseInt(byte, 2)));
}

export function verifyTotp(code: string, secret: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const key = decodeBase32(secret);
  if (!key.length) return false;
  const counter = Math.floor(now / 30_000);
  for (let drift = -1; drift <= 1; drift += 1) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter + drift));
    const hmac = createHmac("sha1", key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    const candidate = String(value).padStart(6, "0");
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) return true;
  }
  return false;
}
