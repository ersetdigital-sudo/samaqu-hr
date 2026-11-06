import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { DEPARTMENTS } from "@/lib/employees/types";
import { requireRole } from "@/lib/auth/session";
import { APPLICATION_STAGES, type ApplicationPage, type JobApplication, type JobInput, type JobPosting, type JobSummary } from "@/lib/recruitment/live/types";
import { effectiveStatus, recordOf, validateJob } from "@/lib/recruitment/live/validation";
import { assertId, dbFailure, RecruitmentError } from "@/lib/recruitment/live/http";

const APPLICATION_COLUMNS = "id,job_id,application_number,full_name,whatsapp,email,birth_date,city,education,has_admin_experience,last_position,last_company,experience_length,skills,expected_salary,start_availability,source,portfolio_url,motivation,consent_at,stage,internal_note,reviewed_at,created_at,updated_at";
const effective = (job:JobPosting):JobPosting => ({...job,status:effectiveStatus(job.status,job.closes_at)});
export async function listJobs():Promise<JobSummary[]> {
  const db = await getServerSupabase(); const jobs:JobPosting[]=[];
  for(let from=0;;from+=200) {
    const {data,error}=await db.from("job_postings").select("*").order("created_at",{ascending:false}).order("id").range(from,from+199);
    if(error)dbFailure(error); jobs.push(...data as JobPosting[]); if(data.length<200)break;
  }
  return Promise.all(jobs.map(async job=>{
    const queries=await Promise.all([
      db.from("job_applications").select("id",{head:true,count:"exact"}).eq("job_id",job.id),
      db.from("job_applications").select("id",{head:true,count:"exact"}).eq("job_id",job.id).is("reviewed_at",null),
      db.from("job_applications").select("id",{head:true,count:"exact"}).eq("job_id",job.id).eq("stage","Diterima"),
    ]);
    for(const q of queries)if(q.error)dbFailure(q.error);
    return {...effective(job),applicant_count:queries[0].count??0,unreviewed_count:queries[1].count??0,accepted_count:queries[2].count??0};
  }));
}
export async function getJob(id:string):Promise<JobPosting|null> {
  assertId(id); const {data,error}=await(await getServerSupabase()).from("job_postings").select("*").eq("id",id).maybeSingle();
  if(error)dbFailure(error); return data ? effective(data as JobPosting):null;
}
export async function getDepartments():Promise<string[]> {
  await requireRole(["hr_manager","recruiter"]);
  const db=await getServerSupabase();const values=new Set<string>(DEPARTMENTS);
  for(const table of ["job_postings"]){
    for(let from=0;;from+=500){
      const {data,error}=await db.from(table).select("department").order("id").range(from,from+499);
      if(error)dbFailure(error);for(const row of data)if(row.department)values.add(row.department);if(data.length<500)break;
    }
  }
  return [...values].sort((a,b)=>a.localeCompare(b,"id"));
}
export async function saveJob(value:unknown,userId:string,id?:string):Promise<JobPosting> {
  const errors=validateJob(value);if(Object.keys(errors).length)throw new RecruitmentError("Periksa isian lowongan",400,errors);
  const input=recordOf(value) as JobInput;
  const row:JobInput={slug:input.slug,title:input.title.trim(),department:input.department.trim(),location:input.location.trim(),employment_type:input.employment_type,headcount:input.headcount,summary:input.summary.trim(),duties:input.duties.map(v=>v.trim()),qualifications:input.qualifications.map(v=>v.trim()),closes_at:input.closes_at||null,status:input.status};
  if(id) {
    const current=await getJob(id);if(!current)throw new RecruitmentError("Lowongan tidak ditemukan",404);
    if(current.published_at && current.slug!==row.slug)throw new RecruitmentError("Slug terkunci setelah dipublikasikan",400,{slug:"Slug tidak bisa diubah setelah publikasi"});
    if(current.status==="Ditutup")row.status="Ditutup";
    if(current.published_at && row.status==="Draf")throw new RecruitmentError("Lowongan terpublikasi tidak bisa dijadikan draf");
  }
  const db=await getServerSupabase();
  const query=id ? db.from("job_postings").update(row).eq("id",id):db.from("job_postings").insert({...row,created_by:userId});
  const {data,error}=await query.select("*").single();if(error){if(error.code==="23505")throw new RecruitmentError("Link lowongan sudah dipakai",409,{slug:"Gunakan slug yang berbeda"});dbFailure(error);}
  return effective(data as JobPosting);
}
export async function changeJobStatus(id:string,action:"publish"|"close"):Promise<JobPosting> {
  const current=await getJob(id);if(!current)throw new RecruitmentError("Lowongan tidak ditemukan",404);
  if(action==="publish" && current.status!=="Draf")throw new RecruitmentError("Hanya draf yang bisa dipublikasikan");
  if(action==="close" && current.status!=="Aktif")throw new RecruitmentError("Lowongan tidak sedang aktif");
  const {data,error}=await(await getServerSupabase()).from("job_postings").update({status:action==="publish"?"Aktif":"Ditutup"}).eq("id",id).eq("status",current.status).select("*").maybeSingle();
  if(error)dbFailure(error);if(!data)throw new RecruitmentError("Lowongan sudah berubah. Muat ulang halaman.",409);return effective(data as JobPosting);
}
export async function listApplications(jobId:string,{search="",stage="",page=1}:{search?:string;stage?:string;page?:number}={}):Promise<ApplicationPage> {
  assertId(jobId);const db=await getServerSupabase();const pageSize=10;
  const currentPage=Number.isInteger(page)&&page>0?Math.min(page,100000):1;
  let query=db.from("job_applications").select(APPLICATION_COLUMNS,{count:"exact"}).eq("job_id",jobId);
  if(stage && stage!=="Semua") {if(!APPLICATION_STAGES.includes(stage))throw new RecruitmentError("Tahap tidak valid");query=query.eq("stage",stage);}
  const term=search.slice(0,100).replace(/[,%.()*_"\\]/g," ").trim();
  if(term)query=query.or(`full_name.ilike.%${term}%,city.ilike.%${term}%`);
  const [result,unread,...counts]=await Promise.all([
    query.order("created_at",{ascending:false}).order("id").range((currentPage-1)*pageSize,currentPage*pageSize-1),
    db.from("job_applications").select("id",{head:true,count:"exact"}).eq("job_id",jobId).is("reviewed_at",null),
    ...APPLICATION_STAGES.map(s=>db.from("job_applications").select("id",{head:true,count:"exact"}).eq("job_id",jobId).eq("stage",s)),
  ]);
  for(const q of [result,unread,...counts])if(q.error)dbFailure(q.error);
  return {applications:(result.data??[]) as JobApplication[],total:result.count??0,unreviewed:unread.count??0,stage_counts:Object.fromEntries(APPLICATION_STAGES.map((s,i)=>[s,counts[i].count??0])),page:currentPage,page_size:pageSize};
}
export async function updateApplication(id:string,value:unknown):Promise<JobApplication> {
  assertId(id);const input=recordOf(value);const update:Record<string,unknown>={};
  if("stage" in input) {if(typeof input.stage!=="string"||!APPLICATION_STAGES.includes(input.stage))throw new RecruitmentError("Tahap tidak valid");update.stage=input.stage;}
  if("internal_note" in input){if(typeof input.internal_note!=="string"||input.internal_note.length>10000)throw new RecruitmentError("Catatan maksimal 10.000 karakter");update.internal_note=input.internal_note;}
  if(input.reviewed===true)update.reviewed_at=new Date().toISOString();
  if(!Object.keys(update).length)throw new RecruitmentError("Tidak ada perubahan yang valid");
  const {data,error}=await(await getServerSupabase()).from("job_applications").update(update).eq("id",id).select(APPLICATION_COLUMNS).maybeSingle();
  if(error)dbFailure(error);if(!data)throw new RecruitmentError("Pelamar tidak ditemukan",404);return data as JobApplication;
}
export async function getApplicationCv(id:string):Promise<string> {
  assertId(id);const db=await getServerSupabase();
  const {data,error}=await db.from("job_applications").select("cv_path").eq("id",id).maybeSingle();
  if(error)dbFailure(error);if(!data)throw new RecruitmentError("CV tidak ditemukan",404);
  const signed=await db.storage.from("cvs").createSignedUrl(data.cv_path,60);
  if(signed.error)throw new RecruitmentError("Gagal membuka CV",500);return signed.data.signedUrl;
}
