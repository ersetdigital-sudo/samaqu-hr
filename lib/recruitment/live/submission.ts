import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getServiceSupabase } from "@/lib/supabase/server";
import { MAX_CV_BYTES, type ApplicationInput } from "@/lib/recruitment/live/types";
import { recordOf, validateApplicationStep } from "@/lib/recruitment/live/validation";
import { assertId, assertSameOrigin, RecruitmentError } from "@/lib/recruitment/live/http";
import { submitApplication } from "@/lib/recruitment/live/public-repository";

export async function consumeSubmitLimit(request:Request) {
  let ip="local-development";
  if(process.env.VERCEL){
    ip=request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim()||"";
    if(!isIP(ip))throw new RecruitmentError("Alamat jaringan tidak dapat diverifikasi",503);
  }else if(process.env.NODE_ENV==="production"){
    throw new RecruitmentError("Konfigurasi proxy tepercaya belum tersedia",503);
  }
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret)throw new RecruitmentError("Konfigurasi server belum lengkap",503);
  const hash=createHmac("sha256",secret).update(`recruitment:${ip}`).digest("hex");
  const {data,error}=await getServiceSupabase().rpc("consume_recruitment_submit",{p_ip_hash:hash});
  if(error)throw new RecruitmentError("Pengecekan pengiriman belum tersedia. Coba lagi nanti.",503);
  if(data!==true)throw new RecruitmentError("Batas 5 pengiriman per jam tercapai. Coba lagi nanti.",429);
}
async function limitedFormData(request:Request):Promise<FormData> {
  const limit=MAX_CV_BYTES+65536;
  if(Number(request.headers.get("content-length"))>limit)throw new RecruitmentError("CV maksimal 2 MB",413,{cv:"CV maksimal 2 MB"});
  const reader=request.body?.getReader();if(!reader)throw new RecruitmentError("Form lamaran kosong");
  const chunks:Uint8Array[]=[];let bytes=0;
  for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>limit){await reader.cancel();throw new RecruitmentError("CV maksimal 2 MB",413,{cv:"CV maksimal 2 MB"});}chunks.push(chunk.value);}
  const body=Buffer.concat(chunks);
  try{return await new Response(body,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();}
  catch{throw new RecruitmentError("Format lamaran tidak valid");}
}
export async function receiveApplication(request:Request):Promise<string> {
  assertSameOrigin(request);
  await consumeSubmitLimit(request);
  const form=await limitedFormData(request);
  let raw:unknown;try{const data=form.get("data");if(typeof data!=="string"||data.length>20000)throw new Error();raw=JSON.parse(data);}catch{throw new RecruitmentError("Data lamaran tidak valid");}
  const input=recordOf(raw);
  if((typeof input.website==="string"&&input.website.trim()) || (typeof form.get("website")==="string"&&String(form.get("website")).trim()))throw new RecruitmentError("Lamaran tidak dapat diproses");
  const errors={...validateApplicationStep(input,1),...validateApplicationStep(input,2),...validateApplicationStep(input,3)};
  const cv=form.get("cv");
  if(!(cv instanceof File)||cv.size===0)errors.cv="Pilih file CV";
  else if(cv.size>MAX_CV_BYTES)errors.cv="CV maksimal 2 MB";
  else if(cv.type!=="application/pdf"||!cv.name.toLowerCase().endsWith(".pdf")||new TextDecoder().decode(await cv.slice(0,5).arrayBuffer())!=="%PDF-")errors.cv="CV harus berupa file PDF yang valid";
  if(Object.keys(errors).length)throw new RecruitmentError("Periksa kembali isian kamu",400,errors);
  if(typeof input.job_id!=="string")throw new RecruitmentError("Lowongan tidak ditemukan",404);assertId(input.job_id);
  return submitApplication(input.job_id,input as unknown as ApplicationInput,cv as File);
}
