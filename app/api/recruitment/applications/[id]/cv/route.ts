import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { getApplicationCv } from "@/lib/recruitment/live/repository";
import { recruitmentFailure } from "@/lib/recruitment/live/http";

export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const guard=await requireApiRole(["hr_manager","recruiter"]);if(guard.response)return guard.response;
  try{const {id}=await params;const response=NextResponse.redirect(await getApplicationCv(id));response.headers.set("Cache-Control","no-store");response.headers.set("Referrer-Policy","no-referrer");return response;}catch(error){return recruitmentFailure(error);}
}
