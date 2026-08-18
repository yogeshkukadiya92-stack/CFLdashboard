import { NextResponse } from "next/server";
import { SALES_SESSION_COOKIE } from "@/lib/sales-session";
export async function POST(){const response=NextResponse.json({ok:true});response.cookies.set({name:SALES_SESSION_COOKIE,value:"",path:"/",maxAge:0});return response}
