import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('.test-output',{recursive:true});
await build({entryPoints:['lib/applications.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/applications.mjs'});
const {newApplication,point,calendarEvents}=await import('../.test-output/applications.mjs');
const base=process.env.JOBTIME_TEST_URL||'http://localhost:3000';
const headers={'Content-Type':'application/json',Origin:base};
if(process.env.JOBTIME_TEST_TOKEN)headers['OAI-Sites-Authorization']='Bearer '+process.env.JOBTIME_TEST_TOKEN;
async function get(){const r=await fetch(base+'/api/state',{headers});assert.equal(r.status,200);return r.json()}
async function post(body,status=200){const r=await fetch(base+'/api/state',{method:'POST',headers,body:JSON.stringify(body)}),s=await r.json();assert.equal(r.status,status,JSON.stringify(s));return s}
const marker='.test-output/persistence.json';
if(process.argv[2]==='setup'){
 const before=await get();await writeFile('.test-output/before-integration.json',JSON.stringify(before));
 const a=newApplication();a.companyName='JOBTIME 검증기업';a.postingTitle='통합 검증용 공고';a.notes='검증 후 이 공고만 삭제';
 let s=await post({action:'save',revision:before.revision,application:a});assert.equal(s.applications.length,before.applications.length+1);
 assert.equal(s.applications.find(x=>x.id===a.id).recruitment.end,null);
 const saved=s.applications.find(x=>x.id===a.id);saved.managementStatus='active';saved.stages[0].status='completed';saved.currentStageId=saved.stages[2].id;
 saved.recruitment.end=point({date:'2026-09-30',time:null});
 saved.stages[2].schedule.start=point({date:'2026-09-15',time:'09:30'});saved.stages[2].schedule.end=point({date:'2026-09-15',time:'11:00'});
 saved.stages[2].resultExpectedAt=point({date:'2026-09-20',time:null});
 saved.personalEvents.push({id:crypto.randomUUID(),title:'자기소개서 검토',notes:'개인 일정',schedule:{start:point({date:'2026-09-10',time:null}),end:null,tentative:true}});
 s=await post({action:'save',revision:s.revision,application:saved});
 await post({action:'save',revision:before.revision,application:a},409);
 const invalid=structuredClone(saved);invalid.recruitment.start=point({date:'2026-10-01',time:null});await post({action:'save',revision:s.revision,application:invalid},400);
 assert.deepEqual(await get(),s);
 await writeFile(marker,JSON.stringify({id:a.id,state:s,base}));
 console.log('PASS manual create/update, stage independence, stale revision 409, invalid dates 400; test record retained for restart/UI verification');
}else if(process.argv[2]==='capture-ui'){
 const expected=JSON.parse(await readFile(marker,'utf8')),s=await get();
 const a=s.applications.find(x=>x.id===expected.id);assert.equal(a.notes,'화면 저장 검증 완료');assert.equal(s.revision,expected.state.revision+1);
 expected.state=s;await writeFile(marker,JSON.stringify(expected));console.log('PASS UI saved memo persisted via API; captured exact state before process restart');
}else if(process.argv[2]==='verify'){
 const expected=JSON.parse(await readFile(marker,'utf8')),s=await get();assert.equal(expected.base,base);assert.deepEqual(s,expected.state);
 const a=s.applications.find(x=>x.id===expected.id);assert.equal(a.stages[0].status,'completed');assert.equal(a.managementStatus,'active');assert.equal(a.recruitment.end.time,null);assert.ok(calendarEvents([a]).some(e=>e.type==='exam'));assert.ok(calendarEvents([a]).some(e=>e.type==='personal'));
 const after=await post({action:'delete',id:a.id,revision:s.revision});assert.equal(after.applications.length,s.applications.length-1);assert.deepEqual(after.applications,s.applications.filter(x=>x.id!==a.id));assert.deepEqual(await get(),after);
 console.log('PASS reload/restart persistence, shared calendar data, delete only test record; original records unchanged');
}else if(process.argv[2]==='official'){
 const before=await get();const r=await fetch(base+'/api/search',{method:'POST',headers,body:JSON.stringify({query:'기업은행'})}),found=await r.json();assert.equal(r.status,200);assert.ok(found.postings.length);assert.deepEqual(await get(),before);
 const selected=found.postings[0],s=await post({action:'add-selected',revision:before.revision,provider:found.provider,postingId:selected.id,allowDuplicate:true});
 const a=s.applications.find(a=>!before.applications.some(b=>b.id===a.id));assert.ok(a);assert.equal(s.applications.length,before.applications.length+1);assert.equal(a.officialPostingId,selected.id);assert.equal(a.postingUrl,selected.url);assert.deepEqual(a.recruitment.end,point(selected.end));
 const after=await post({action:'delete',id:a.id,revision:s.revision});assert.deepEqual(after.applications,before.applications);console.log('PASS official search has no writes; exactly one selected posting saved with original deadline; test selection removed');
}else if(process.argv[2]==='search'){
 for(const query of ['국민은행','기업은행','농협은행']){const r=await fetch(base+'/api/search',{method:'POST',headers,body:JSON.stringify({query})});const s=await r.json();assert.equal(r.status,200,JSON.stringify(s));assert.ok(Array.isArray(s.postings));console.log(query+': '+s.postings.length+' official candidates'+(s.warning?' (provider warning)':''))}
}else throw new Error('Use setup, verify or search');
