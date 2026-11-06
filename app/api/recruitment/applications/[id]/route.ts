import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { updateApplication } from "@/lib/recruitment/live/repository";
import { assertSameOrigin, readJson, recruitmentFailure } from "@/lib/recruitment/live/http";

export const dynamic="force-dynamic";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const guard=await requireApiRole(["hr_manager","recruiter"]);if(guard.response)return guard.response;
  try{assertSameOrigin(request);const {id}=await params;return NextResponse.json({application:await updateApplication(id,await readJson(request))},{headers:{"Cache-Control":"no-store"}});}catch(error){return recruitmentFailure(error);}
}
