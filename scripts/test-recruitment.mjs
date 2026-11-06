import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) return { url: pathToFileURL(resolve(specifier.slice(2) + '.ts')).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, shortCircuit: true };
    return next(url, context);
  },
});
const v = await import('../lib/recruitment/live/validation.ts');
const job = { title:'Staf Admin',slug:'staf-admin',department:'Operasional',location:'Bandung',employment_type:'Full-time',headcount:1,summary:'Kelola pesanan',duties:['Rekap'],qualifications:['Teliti'],closes_at:null,status:'Draf' };
const application = { full_name:'Pelamar Uji',whatsapp:'081234567890',email:'uji@example.invalid',birth_date:'2000-01-01',city:'Bandung',education:'SMA/SMK',has_admin_experience:false,last_position:'',last_company:'',experience_length:'',skills:[],expected_salary:3000000,start_availability:'Segera',source:'',portfolio_url:'',motivation:'',consent:true };
test('valid job and application pass',()=>{assert.deepEqual(v.validateJob(job),{});for(let step=1;step<=3;step++)assert.deepEqual(v.validateApplicationStep(application,step),{});});
test('job rejects invalid slug dates enum arrays and summary',()=>{const errors=v.validateJob({...job,slug:'../bad',closes_at:'2026-02-30',employment_type:'Remote',headcount:0,summary:'a'.repeat(201),duties:Array(9).fill('x')});for(const key of ['slug','closes_at','employment_type','headcount','summary','duties'])assert.ok(errors[key],key);});
test('application validates every step and rejects unsafe portfolio',()=>{assert.ok(v.validateApplicationStep({...application,email:'bad',birth_date:'2099-01-01'},1).birth_date);assert.ok(v.validateApplicationStep({...application,has_admin_experience:true},2).last_position);assert.ok(v.validateApplicationStep({...application,expected_salary:-1},2).expected_salary);assert.ok(v.validateApplicationStep({...application,portfolio_url:'javascript:alert(1)',consent:false},3).portfolio_url);assert.ok(v.validateApplicationStep({...application,consent:false},3).consent);});
test('normalize Indonesian WhatsApp into one duplicate key',()=>{for(const input of ['0812 3456 7890','+62 812-3456-7890','6281234567890','81234567890'])assert.equal(v.normalizeWhatsapp(input),'6281234567890');});
test('malformed inputs cannot bypass validation or crash',()=>{for(const input of [null,[],5,'x',{}]) {assert.ok(Object.keys(v.validateJob(input)).length);assert.ok(Object.keys(v.validateApplicationStep(input,1)).length);}assert.ok(v.validateApplicationStep({...application,skills:['Unknown']},2).skills);});
test('slug generation and Jakarta closing date boundary',()=>{assert.equal(v.slugify(' Staf Admin & Gudang '),'staf-admin-gudang');assert.equal(v.effectiveStatus('Aktif','2026-11-06',new Date('2026-11-06T16:59:59Z')),'Aktif');assert.equal(v.effectiveStatus('Aktif','2026-11-06',new Date('2026-11-06T17:00:00Z')),'Ditutup');assert.equal(v.effectiveStatus('Draf','2020-01-01'),'Draf');});
