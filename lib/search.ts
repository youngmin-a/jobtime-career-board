import {load} from 'cheerio';
import {BANKS,resolveBank,validPoint,type DatePoint} from './jobs';
import {fetchCompany,publicFetch} from './providers';
import type {Candidate,SearchResult,Selection} from './search-types';
const clean=(x:unknown,max=200)=>typeof x==='string'?x.replace(/\s+/g,' ').trim().slice(0,max):'';
function date(x:unknown):DatePoint|null{if(typeof x!=='string'||!/^20\d{6}$/.test(x))return null;const p={date:x.slice(0,4)+'-'+x.slice(4,6)+'-'+x.slice(6,8),time:null};return validPoint(p)?p:null}
export function parsePublicJobs(rows:unknown):Candidate[]{if(!Array.isArray(rows))throw new Error('공개 검색 결과 형식이 변경되었습니다.');return rows.flatMap(v=>{
 if(!v||typeof v!=='object')return[];const title=clean(v.title),companyName=clean(v.companyNm,100),id=clean(v.jobId,30);if(!title||!companyName||!/^\d{13}$/.test(id))return[];
 const start=date(v.inviteStartDt),end=date(v.inviteCloseDt);
 // regDate/modDate/svcStartDate are posting/update dates, never recruitment dates.
 return[{id,provider:'incruit',companyName,title,role:clean(v.pstnNm,100),employmentType:clean(v.employTyNm,100),url:'https://job.incruit.com/jobdb_info/jobpost.asp?job='+id,start,end,sourceName:'인크루트 공개 채용정보',sourceKind:'public' as const,evidence:'인크루트 모집기간: '+(start?.date??'미공개')+' ~ '+(end?.date??'미공개')+' · 정확한 시각은 원문 확인',checkedAt:new Date().toISOString()}]
})}
// Parse only JSON transport data. Never evaluate page scripts or RSC content.
export function publicRowsFromHtml(html:string):unknown[]{const $=load(html);let text='';$('script').each((_,el)=>{const m=$(el).text().match(/^self\.__next_f\.push\((\[[\s\S]*\])\)$/);if(!m)return;try{const v=JSON.parse(m[1]);if(v[0]===1&&typeof v[1]==='string')text+=v[1]}catch{}});const key=text.indexOf('"initialJobs":');if(key<0)throw new Error('공개 검색 페이지 형식을 확인하지 못했습니다.');const start=text.indexOf('[',key);let depth=0,inString=false,escape=false;for(let i=start;i<text.length;i++){const c=text[i];if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inString=false;continue}if(c==='"')inString=true;else if(c==='[')depth++;else if(c===']'&&--depth===0)return JSON.parse(text.slice(start,i+1))}throw new Error('검색 데이터가 완전하지 않습니다.')}
const searchCache=new Map<string,{expires:number;candidates:Candidate[];total:number}>();
async function publicSearch(query:string){const cached=searchCache.get(query);if(cached&&cached.expires>Date.now())return cached;const api='https://jlab.incruit.com/lab/api/mobile/search?'+new URLSearchParams({q:query,page:'1',rows:'20'}),html='https://jlab.incruit.com/search?'+new URLSearchParams({q:query});let last:unknown;
 for(const [i,url]of [api,html,html].entries()){try{const response=await publicFetch(url);let candidates:Candidate[],total:number;if(i===0){const data=JSON.parse(response.body.toString('utf8'));if(data.success!==true)throw new Error('검색 실패');candidates=parsePublicJobs(data.docs);total=Number(data.numFound)||candidates.length}else{candidates=parsePublicJobs(publicRowsFromHtml(response.body.toString('utf8')));total=candidates.length}const result={candidates,total,expires:Date.now()+60000};if(searchCache.size>=30)searchCache.delete(searchCache.keys().next().value!);searchCache.set(query,result);return result}catch(e){last=e}}
 throw last;
}
async function bankSearch(provider:string){const bank=BANKS.find(b=>b.id===provider);if(!bank)throw new Error('공식 출처를 확인해주세요.');const result=await fetchCompany({id:bank.id,name:bank.name,provider:bank.id});return{candidates:result.postings.map(p=>({id:p.id,provider:bank.id,companyName:bank.name,title:p.title,role:'',employmentType:'',url:p.url,start:p.start,end:p.end,sourceName:bank.name+' 공식 채용',sourceKind:'official' as const,evidence:p.evidence,checkedAt:p.checkedAt})),warning:result.warning}}
export async function searchJobs(query:string):Promise<SearchResult>{const warnings:string[]=[],candidates:Candidate[]=[];let total=0,bank=resolveBank(query),targetId:string|undefined;
 if(/^https?:\/\//i.test(query)){const u=new URL(query);if(u.protocol!=='https:'||u.port||u.username||u.password)throw new Error('HTTPS 공식 공고 주소를 입력해주세요.');if(u.hostname==='kbstar.careerlink.kr')bank=BANKS[0];else if(['ibk.incruit.com','ibk3.incruit.com','ibk4.incruit.com'].includes(u.hostname))bank=BANKS[1];else if(u.hostname==='nhbank.incruit.com')bank=BANKS[2];else throw new Error('주소 검색은 기존 은행 공식 주소를 지원합니다. 다른 기업은 기업명·키워드로 검색하거나 직접 등록해주세요.');targetId=u.searchParams.get('projectid')??u.pathname.split('/').filter(Boolean).at(-1)}
 const results=await Promise.allSettled([publicSearch(bank?.name??query),...(bank?[bankSearch(bank.id)]:[])]);
 if(results[1]?.status==='fulfilled'){const r=results[1].value as Awaited<ReturnType<typeof bankSearch>>;candidates.push(...r.candidates);if(r.warning)warnings.push(r.warning)}else if(bank)warnings.push('은행 공식 조회가 일시적으로 응답하지 않습니다.');
 const broad=results[0];if(broad.status==='fulfilled'){candidates.push(...broad.value.candidates);total=broad.value.total??broad.value.candidates.length}else warnings.push('공개 채용 검색이 일시적으로 응답하지 않습니다. 잠시 후 다시 검색하거나 직접 등록해주세요.');
 const unique=candidates.filter((c,i,a)=>a.findIndex(x=>x.url===c.url)===i);const exact=targetId?unique.filter(c=>{const u=new URL(c.url);return c.url===query||u.searchParams.get('projectid')===targetId||u.pathname.split('/').at(-1)===targetId}):[];
 return{query:bank?.name??query,candidates:exact.length?exact:unique,warnings,total:Math.max(total,unique.length)};
}
export async function resolveSelection(s:Selection):Promise<Candidate>{if(!s||typeof s.query!=='string'||s.query.length>2000||typeof s.id!=='string')throw new Error('공고 선택 정보를 확인해주세요.');const result=s.provider==='incruit'?await publicSearch(s.query):await bankSearch(s.provider);const found=result.candidates.find(c=>c.id===s.id&&c.provider===s.provider);if(!found)throw new Error('공고가 변경되었거나 검색 결과에서 제외되었습니다. 다시 검색해주세요. 입력 내용은 유지됩니다.');return found}


