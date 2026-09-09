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
type PublicPage={candidates:Candidate[];total:number;hasMore:boolean;partial:boolean};
const searchCache=new Map<string,{expires:number;page:PublicPage}>();
const PAGE_SIZE=50,MAX_PAGES=10;
export async function publicSearchPage(query:string,page=1):Promise<PublicPage>{
 const key=['2026-H2','include-closed',query,page,PAGE_SIZE].join(':');const cached=searchCache.get(key);if(cached&&cached.expires>Date.now())return cached.page;
 let result:PublicPage;
 try{
  const response=await publicFetch('https://jlab.incruit.com/lab/api/mobile/search?'+new URLSearchParams({q:query,page:String(page),rows:String(PAGE_SIZE)}));
  const data=JSON.parse(response.body.toString('utf8'));if(data.success!==true)throw new Error('공개 검색 조회 실패');
  const candidates=parsePublicJobs(data.docs).map(c=>({...c,sourcePage:page})),total=Number(data.numFound)||candidates.length;
  result={candidates,total,hasMore:page*PAGE_SIZE<total,partial:false};
 }catch{
  if(page!==1)throw new Error('추가 페이지 조회에 실패했습니다. 앞서 확인된 결과는 유지됩니다.');
  const response=await publicFetch('https://jlab.incruit.com/search?'+new URLSearchParams({q:query}));
  const candidates=parsePublicJobs(publicRowsFromHtml(response.body.toString('utf8'))).map(c=>({...c,sourcePage:1}));
  result={candidates,total:candidates.length,hasMore:true,partial:true};
 }
 if(searchCache.size>=60)searchCache.delete(searchCache.keys().next().value!);searchCache.set(key,{expires:Date.now()+60000,page:result});return result;
}
async function bankSearch(provider:string){const bank=BANKS.find(b=>b.id===provider);if(!bank)throw new Error('공식 출처를 확인해주세요.');const result=await fetchCompany({id:bank.id,name:bank.name,provider:bank.id});return{candidates:result.postings.map(p=>({id:p.id,provider:bank.id,companyName:bank.name,title:p.title,role:'',employmentType:'',url:p.url,start:p.start,end:p.end,sourceName:bank.name+' 공식 채용',sourceKind:'official' as const,evidence:p.evidence,checkedAt:p.checkedAt})),warning:result.warning}}

export const WOORI_ARCHIVE_URL='https://jrs.jobkorea.co.kr/wooribank/wooribank264/Agi/InvitePrint';
export function parseWooriArchive(source:string):Candidate{
 const $=load(source);$('script,style').remove();const text=$('body').text().replace(/\s+/g,' ').trim();
 const title=text.match(/공고명(.*?)(?=접수기간)/)?.[1]?.trim();
 const match=text.match(/접수기간\s*(20\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}:\d{2})\s*~\s*(20\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}:\d{2})/);
 if(!text.includes('우리은행')||!title||!match)throw new Error('우리은행 공식 마감 공고의 제목·접수기간을 확인하지 못했습니다.');
 const start={date:`${match[1]}-${match[2]}-${match[3]}`,time:match[4]},end={date:`${match[5]}-${match[6]}-${match[7]}`,time:match[8]};if(!validPoint(start)||!validPoint(end))throw new Error('공식 모집기간 형식이 변경되었습니다.');
 return {id:'wooribank264',provider:'woori-archive',companyName:'우리은행',title,role:'',employmentType:'',url:WOORI_ARCHIVE_URL,start,end,sourceName:'우리은행 공식 채용 접수 페이지',sourceKind:'official',evidence:'공식 공고명: '+title+' · 접수기간: '+match[0].replace(/^접수기간\s+/,''),checkedAt:new Date().toISOString()};
}
async function wooriArchive(){const r=await publicFetch(WOORI_ARCHIVE_URL);return parseWooriArchive(r.body.toString('utf8'))}
import {verifiedCandidates} from './search-scope';
import {normalizedPostingUrl} from './posting-identity';
export async function searchJobs(query:string,page=1):Promise<SearchResult>{
 if(!Number.isSafeInteger(page)||page<1||page>MAX_PAGES)throw new Error('조회 페이지를 확인해주세요.');
 const warnings:string[]=[],candidates:Candidate[]=[];let bank=resolveBank(query),targetUrl:string|undefined;
 if(/^https?:\/\//i.test(query)){
  const u=new URL(query);if(u.protocol!=='https:'||u.port||u.username||u.password)throw new Error('HTTPS 공식 공고 주소를 입력해주세요.');targetUrl=u.href;
  if(u.hostname==='kbstar.careerlink.kr')bank=BANKS[0];else if(['ibk.incruit.com','ibk3.incruit.com','ibk4.incruit.com'].includes(u.hostname))bank=BANKS[1];else if(u.hostname==='nhbank.incruit.com')bank=BANKS[2];else if(u.href!==WOORI_ARCHIVE_URL)throw new Error('지원하지 않는 주소입니다. 기업명으로 검색하거나 직접 등록해주세요.');
 }
 const queryText=bank?.name??(targetUrl===WOORI_ARCHIVE_URL?'우리은행':query);
 const isWoori=/우리\s*은행|woori/i.test(queryText),requests:Promise<unknown>[]=[publicSearchPage(queryText,page)];
 if(bank&&page===1)requests.push(bankSearch(bank.id));if(isWoori&&page===1)requests.push(wooriArchive());
 const results=await Promise.allSettled(requests);let total=0,hasMore=false,partial=false,success=0;
 if(results[0].status==='fulfilled'){const r=results[0].value as PublicPage;candidates.push(...r.candidates);total=r.total;hasMore=r.hasMore;partial=r.partial;success++;if(partial)warnings.push('공개 검색 API가 응답하지 않아 첫 공개 페이지를 확인했습니다. 추가 조회가 실패할 수 있으며 전체 검색 결과가 아닙니다.');}
 else warnings.push(page===1?'공개 검색 소스 조회에 실패했습니다. 확인된 공식 공고만 표시합니다.':'추가 페이지 조회에 실패했습니다. 기존 결과를 유지했습니다. 잠시 후 다시 불러와 주세요.');
 let index=1;if(bank&&page===1){const r=results[index++];if(r.status==='fulfilled'){const v=r.value as Awaited<ReturnType<typeof bankSearch>>;candidates.push(...v.candidates);success++;if(v.warning)warnings.push(v.warning)}else warnings.push('은행 공식 목록 조회에 실패했습니다.');}
 if(isWoori&&page===1){const r=results[index];if(r.status==='fulfilled'){candidates.push(r.value as Candidate);success++}else warnings.push('우리은행 공식 마감 공고 원문 조회에 실패했습니다.');}
 const unique=verifiedCandidates(candidates).filter((c,i,a)=>a.findIndex(x=>normalizedPostingUrl(x.url)===normalizedPostingUrl(c.url))===i).filter(c=>!targetUrl||normalizedPostingUrl(c.url)===normalizedPostingUrl(targetUrl));
 if(page===MAX_PAGES&&hasMore)warnings.push('공개 검색 후보 500개까지 확인했습니다. 검색어를 구체화해 주세요.');
 return {query:queryText,candidates:unique,warnings,total,scanned:candidates.length,partial:partial||hasMore,failed:success===0,nextPage:hasMore&&page<MAX_PAGES?page+1:null};
}
export async function resolveSelection(s:Selection):Promise<Candidate>{
 if(!s||typeof s.query!=='string'||s.query.length>2000||typeof s.id!=='string')throw new Error('공고 선택 정보를 확인해주세요.');
 const page=s.page??1;if(!Number.isSafeInteger(page)||page<1||page>MAX_PAGES)throw new Error('공고 페이지를 확인해주세요.');
 const candidates=s.provider==='woori-archive'?[await wooriArchive()]:s.provider==='incruit'?(await publicSearchPage(s.query,page)).candidates:(await bankSearch(s.provider)).candidates;
 const found=verifiedCandidates(candidates).find(c=>c.id===s.id&&c.provider===s.provider);if(!found)throw new Error('2026년 하반기 공고 원문을 다시 확인하지 못했습니다. 다시 검색해주세요.');return found;
}
