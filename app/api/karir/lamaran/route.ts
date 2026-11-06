import { NextResponse } from "next/server";
import { receiveApplication } from "@/lib/recruitment/live/submission";
import { recruitmentFailure } from "@/lib/recruitment/live/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request:Request) {
  try {
    const application_number=await receiveApplication(request);
    return NextResponse.json({application_number},{status:201,headers:{"Cache-Control":"no-store"}});
  } catch(error) {return recruitmentFailure(error);}
}
