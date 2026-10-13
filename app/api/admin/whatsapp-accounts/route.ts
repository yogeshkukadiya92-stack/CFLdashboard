import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getWhatsAppAccounts, saveWhatsAppAccount } from "@/lib/whatsapp-accounts";
const publicAccount = ({ authToken: _token, apiUrl: _url, ...account }: Awaited<ReturnType<typeof getWhatsAppAccounts>>[number]) => account;
export async function GET() {
  try { return NextResponse.json({ accounts: (await getWhatsAppAccounts()).map(publicAccount) }); }
  catch { return NextResponse.json({ error: "Could not load WhatsApp numbers." }, { status: 500 }); }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const account = { id: randomUUID(), label: String(body.label || "").trim(), number: String(body.number || "").replace(/\D/g, ""), apiUrl: String(body.apiUrl || "").trim(), authToken: String(body.authToken || "").trim(), otpTemplate: String(body.otpTemplate || "").trim(), language: String(body.language || "en").trim() };
    if (!account.label || !/^\d{10,15}$/.test(account.number) || !account.authToken || new URL(account.apiUrl).protocol !== "https:") return NextResponse.json({ error: "Enter a name, number with country code, HTTPS API URL and API token." }, { status: 400 });
    await saveWhatsAppAccount(account);
    return NextResponse.json({ account: publicAccount(account) });
  } catch { return NextResponse.json({ error: "Could not save WhatsApp number. Check the API URL and try again." }, { status: 400 }); }
}
