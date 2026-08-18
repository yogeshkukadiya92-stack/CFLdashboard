import { NextResponse } from "next/server";
import { getAppState, saveAppState } from "@/lib/db";
import { hashSalesPassword } from "@/lib/sales-auth";
import type { SalesTeamUser } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body=await request.json() as Record<string,unknown>; const salesPerson=body.salesPerson as Record<string,unknown>;
    if(!salesPerson?.id||!String(salesPerson.mobile||"").replace(/\D/g,"")||!String(salesPerson.name||"").trim()) return NextResponse.json({error:"Name and mobile are required."},{status:400});
    const state=await getAppState(); if(!state) return NextResponse.json({error:"Database unavailable."},{status:503});
    const users=(Array.isArray(state.salesTeamUsers)?state.salesTeamUsers:[]) as SalesTeamUser[]; const existing=users.find((u)=>u.salesPersonId===String(salesPerson.id)); const password=String(body.password||"");
    if(!existing&&password.length<6) return NextResponse.json({error:"Password must be at least 6 characters."},{status:400});
    const now=new Date().toISOString(); const mobile=String(salesPerson.mobile).replace(/\D/g,"").slice(-10);
    const user:SalesTeamUser={id:existing?.id||`sales-user-${crypto.randomUUID()}`,salesPersonId:String(salesPerson.id),name:String(salesPerson.name),email:String(salesPerson.email||"").toLowerCase(),mobile,passwordHash:password?hashSalesPassword(password,mobile):existing!.passwordHash,active:salesPerson.isActive!==false,canViewOther:Boolean(salesPerson.canViewOther),createdAt:existing?.createdAt||now,updatedAt:now,lastLoginAt:existing?.lastLoginAt,loginCount:existing?.loginCount||0};
    await saveAppState({salesPeople:[salesPerson,...state.salesPeople.filter((item:any)=>String(item?.id)!==String(salesPerson.id))],salesTeamUsers:[user,...users.filter((u)=>u.id!==user.id)]});
    return NextResponse.json({ok:true,user:{...user,passwordHash:undefined}});
  } catch { return NextResponse.json({error:"Could not save salesperson login."},{status:500}); }
}
