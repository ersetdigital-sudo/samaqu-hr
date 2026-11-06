import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { changeJobStatus, saveJob } from "@/lib/recruitment/live/repository";
import { recordOf } from "@/lib/recruitment/live/validation";
import { assertSameOrigin, readJson, recruitmentFailure } from "@/lib/recruitment/live/http";

export const dynamic="force-dynamic";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const guard=await requireApiRole(["hr_manager","recruiter"]);if(guard.response)return guard.response;
  try{
    assertSameOrigin(request);const {id}=await params;const body=recordOf(await readJson(request));
    const job=body.action==="publish"||body.action==="close" ? await changeJobStatus(id,body.action):await saveJob(body,guard.user.id,id);
    return NextResponse.json({job},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return recruitmentFailure(error);}
}
