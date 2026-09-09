import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {BANKS,parsePeriod,resolveBank,resolveInstitution,validPoint,type DatePoint,type Institution} from './jobs';
import {fetchCompany,publicFetch,safePublicUrl} from './providers';
import type {Candidate,SearchResult,Selection,WebCandidate} from './search-types';
const clean=(x:unknown,max=200)=>typeof x==='string'?x.replace(/\s+/g,' ').trim().slice(0,max):'';
const cleanRich=(x:unknown,max=200)=>{if(typeof x!=='string')return '';try{return clean(load(`<span>${x}</span>`).text(),max)}catch{return clean(x,max)}};
function date(x:unknown):DatePoint|null{if(typeof x!=='string'||!/^20\d{6}$/.test(x))return null;const p={date:x.slice(0,4)+'-'+x.slice(4,6)+'-'+x.slice(6,8),time:null};return validPoint(p)?p:null}
export function extractRecruitmentPeriod(source:string){
 const text=source.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
 const snippets=[text];
 for(const m of text.matchAll(/(?:접수|모집|채용|지원|응시)\s*(?:기간|일정)?/gi))snippets.unshift(text.slice(m.index??0,(m.index??0)+360));
 for(const snippet of snippets){
  const period=parsePeriod(snippet);
  if(period)return period;
 }
 const pointFromText=(raw:string):DatePoint|null=>{const m=raw.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?:일)?(?:\s*\([^)]*\))?(?:\s*(오전|오후)?\s*(\d{1,2})(?::|시\s*)(\d{2})?\s*분?)?/);if(!m)return null;let hour=m[5]?Number(m[5]):null;if(hour!==null&&m[4]==='오후'&&hour<12)hour+=12;if(hour!==null&&m[4]==='오전'&&hour===12)hour=0;const time=hour===null?null:`${String(hour).padStart(2,'0')}:${m[6]??'00'}`;const p={date:`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`,time};return validPoint(p)?p:null};
 const startMatch=text.match(/(?:접수|모집|채용|지원|응시)\s*(?:시작|개시|오픈|부터)\s*[:：]?\s*([^,;|]{0,80})/i);
 const endMatch=text.match(/(?:접수|모집|채용|지원|응시)\s*(?:마감|종료|까지)\s*[:：]?\s*([^,;|]{0,80})/i);
 const start=startMatch?pointFromText(startMatch[1]):null,end=endMatch?pointFromText(endMatch[1]):null;
 if(start&&end)return {start,end,evidence:[startMatch?.[0],endMatch?.[0]].filter(Boolean).join(' · ')};
 return null;
}
function webCandidateFromParts(parts:{title:unknown;url:unknown;description?:unknown;extracted?:unknown;sourceName:string;sourceType:'web'|'news'|'blog'|'tavily';companyName?:string}):WebCandidate|null{
 const title=cleanRich(parts.title,200),url=clean(parts.url,2000);if(!title||!safePublicUrl(url))return null;
 const description=cleanRich(parts.description??'',700),extracted=cleanRich(parts.extracted??'',1800);
 const period=extractRecruitmentPeriod([title,description,extracted].filter(Boolean).join(' '));
 return {id:createHash('sha256').update(url).digest('hex').slice(0,24),title,url,description,sourceName:parts.sourceName,sourceType:parts.sourceType,companyName:parts.companyName,start:period?.start??null,end:period?.end??null,dateEvidence:period?`본문에서 확인한 접수기간: ${period.evidence}`:undefined,extractedContent:extracted||undefined};
}
type NaverKind='web'|'news'|'blog';
export function parseNaverItems(data:unknown,kind:NaverKind,_companyName?:string):WebCandidate[]{
 const items=data&&typeof data==='object'&&Array.isArray((data as {items?:unknown[]}).items)?(data as {items:unknown[]}).items:[];
 const sourceName=kind==='web'?'네이버 웹문서':kind==='news'?'네이버 뉴스':'네이버 블로그';
 return items.flatMap(item=>{
  if(!item||typeof item!=='object')return[];const v=item as Record<string,unknown>;
  const url=kind==='news'&&typeof v.originallink==='string'&&safePublicUrl(v.originallink)?v.originallink:v.link;
  const c=webCandidateFromParts({title:v.title,url,description:v.description,sourceName,sourceType:kind});return c?[c]:[];
 });
}
export function parsePublicJobs(rows:unknown):Candidate[]{if(!Array.isArray(rows))throw new Error('공개 검색 결과 형식이 변경되었습니다.');return rows.flatMap(v=>{
 if(!v||typeof v!=='object')return[];const title=clean(v.title),companyName=clean(v.companyNm,100),id=clean(v.jobId,30);if(!title||!companyName||!/^\d{13}$/.test(id))return[];
 const start=date(v.inviteStartDt),end=date(v.inviteCloseDt);
 // regDate/modDate/svcStartDate are posting/update dates, never recruitment dates.
 return[{id,provider:'incruit',companyName,title,role:clean(v.pstnNm,100),employmentType:clean(v.employTyNm,100),url:'https://job.incruit.com/jobdb_info/jobpost.asp?job='+id,start,end,sourceName:'인크루트 공개 채용정보',sourceKind:'public' as const,evidence:'인크루트 모집기간: '+(start?.date??'미공개')+' ~ '+(end?.date??'미공개')+' · 정확한 시각은 원문 확인',checkedAt:new Date().toISOString()}]
})}
export function parseIncruitDetail(source:string,url:string):Candidate{
 const $=load(source);$('script,style,noscript').remove();const text=clean($.root().text(),20000);
 const parsedUrl=new URL(url),id=parsedUrl.searchParams.get('job')??'';if(!/^\d{13}$/.test(id))throw new Error('인크루트 공고 번호를 확인하지 못했습니다.');
 const meta=$('meta[property="og:title"]').attr('content')??$('h1').first().text()??'';
 const title=clean(meta).replace(/\s*[-|｜].*인크루트.*$/i,'')||clean(text.match(/공고명\s*[:：]?\s*([^\n]{2,200})/)?.[1]??'');
 const company=clean($('[class*="company" i]').first().text())||clean(text.match(/기업명\s*[:：]?\s*(.{2,100}?)(?=\s*(?:접수\s*기간|모집\s*기간|채용\s*기간|공고명)|$)/i)?.[1]??'');
 const periodText=text.match(/(20\d{2}[.\-/년\s]+\d{1,2}[.\-/월\s]+\d{1,2}[^~]{0,40}[~∼～][^\n]{0,120})/)?.[1]??'';
 const extracted=extractRecruitmentPeriod(text);
 const start=extracted?.start??(periodText?dateFromFlexible(periodText,'start'):null),end=extracted?.end??(periodText?dateFromFlexible(periodText,'end'):null);
 if(!title||!company)throw new Error('인크루트 공고 제목·기업명을 자동으로 확인하지 못했습니다. URL을 보존해 직접 등록할 수 있습니다.');
 return {id,provider:'incruit',companyName:company,title,role:'',employmentType:'',url:parsedUrl.href,start,end,sourceName:'인크루트 공고 상세',sourceKind:'public',evidence:`인크루트 원문 확인 · 모집기간: ${start?.date??'미공개'} ~ ${end?.date??'미공개'} · 정확한 시각은 원문 확인`,checkedAt:new Date().toISOString()};
}
export function parseGenericOfficialDetail(source:string,url:string,companyName:string):Candidate{
 const $=load(source);$('script,style,noscript').remove();const text=clean($.root().text(),30000),parsedUrl=new URL(url);
 const title=clean($('meta[property="og:title"]').attr('content')??$('h1').first().text()??$('title').text()??'').replace(/\s*[-|｜].*$/,'');
 const period=extractRecruitmentPeriod(text);
 if(!title)throw new Error('공식 공고 제목을 자동으로 확인하지 못했습니다.');
 const id=createHash('sha256').update(parsedUrl.href).digest('hex').slice(0,24);
 return {id,provider:'official-url',companyName,title,role:'',employmentType:'',url:parsedUrl.href,start:period?.start??null,end:period?.end??null,sourceName:`${companyName} 공식 채용`,sourceKind:'official',evidence:period?`공식 원문 접수기간: ${period.evidence}`:'공식 원문에서 모집기간을 자동 확인하지 못했습니다.',checkedAt:new Date().toISOString()};
}
async function genericOfficialDetail(url:string,companyName:string){const r=await publicFetch(url);return parseGenericOfficialDetail(r.body.toString('utf8'),url,companyName)}
function companyForUrl(url:string,hint=''){
 const host=new URL(url).hostname.toLowerCase();
 if(host==='shinhan.recruiter.co.kr')return'신한은행';
 if(host==='www.fss.or.kr'||host==='fine.fss.or.kr')return'금융감독원';
 if(host==='recruit.kdb.co.kr')return'한국산업은행';
 if(host==='im.recruiter.co.kr')return'iM뱅크';
 return resolveInstitution(hint)?.name??resolveBank(hint)?.name??'';
}
function sourceNameForUrl(url:string){
 const host=new URL(url).hostname.toLowerCase();
 if(host.endsWith('fss.or.kr'))return'금융감독원 공식 채용';
 if(host.endsWith('recruiter.co.kr'))return'기업 공식 채용';
 if(host.includes('incruit.com')||host.includes('incruit.co.kr'))return'인크루트 공고';
 if(host.includes('jobkorea.co.kr'))return'잡코리아 공고';
 if(host.includes('kofia.or.kr'))return'금융투자협회 채용안내';
 if(host.includes('catch.co.kr'))return'캐치 공고';
 if(host.includes('linkareer.com'))return'링커리어 공고';
 if(host.includes('jasoseol.com'))return'자소설닷컴 공고';
 if(host.includes('work.go.kr'))return'워크넷 채용정보';
 return'공개 채용 원문';
}
export async function enrichWebCandidate(url:string,hintCompany=''):Promise<Candidate>{
 const parsed=new URL(url);if(!safePublicUrl(parsed.href))throw new Error('공개 HTTPS 공고 주소를 확인해주세요.');
 if(parsed.hostname==='job.incruit.com')return {...await incruitDetail(parsed.href),provider:'web-source',discoveredBy:'네이버 검색',discoveryUrl:parsed.href};
 const body=(await publicFetch(parsed.href)).body.toString('utf8'),company=companyForUrl(parsed.href,hintCompany);
 if(!company)throw new Error('원문에서 기업명을 자동 확인하지 못했습니다. URL을 보존해 직접 등록하세요.');
 const parsedCandidate=parseGenericOfficialDetail(body,parsed.href,company);
 const official=['recruiter.co.kr','fss.or.kr','kbstar.careerlink.kr','kdb.co.kr'].some(host=>parsed.hostname===host||parsed.hostname.endsWith('.'+host));
 return {...parsedCandidate,provider:'web-source',sourceName:sourceNameForUrl(parsed.href),sourceKind:official?'official':'public',discoveredBy:'네이버 검색',discoveryUrl:parsed.href};
}
function dateFromFlexible(raw:string,which:'start'|'end'):DatePoint|null{
 const m=[...raw.matchAll(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/g)];const hit=m[which==='start'?0:1];if(!hit)return null;const p={date:`${hit[1]}-${hit[2].padStart(2,'0')}-${hit[3].padStart(2,'0')}`,time:null};return validPoint(p)?p:null;
}
async function incruitDetail(url:string):Promise<Candidate>{const r=await publicFetch(url);return parseIncruitDetail(r.body.toString('utf8'),url)}
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
import {uncertainCandidates,verifiedCandidates} from './search-scope';
import {normalizedPostingUrl} from './posting-identity';
export type SearchConfig={braveApiKey?:string;alioApiKey?:string;alioApiUrl?:string;naverClientId?:string;naverClientSecret?:string;tavilyApiKey?:string};
function queryForEntity(query:string,entity:{name:string;aliases:string[]}){let rest=query;for(const alias of entity.aliases){rest=rest.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),' ')}return [entity.name,rest.replace(/\s+/g,' ').trim()].filter(Boolean).join(' ')}
function institutionMatches(company:string,institution:Institution){const value=company.toLowerCase().replace(/\s/g,'');return institution.aliases.some(alias=>value.includes(alias.toLowerCase().replace(/\s/g,'')))}
function officialPathCandidates(institution:Institution):WebCandidate[]{return institution.officialUrls.map(url=>({id:createHash('sha256').update(url).digest('hex').slice(0,24),title:`${institution.name} 공식 채용 경로`,url,description:'진행 중·마감 공고와 상세 모집기간은 공식 채용 경로에서 확인할 수 있습니다.',sourceName:'공식 채용 안내'}))}
async function externalWebSearch(query:string,key:string):Promise<WebCandidate[]>{
 const response=await fetch('https://api.search.brave.com/res/v1/web/search?'+new URLSearchParams({q:query,count:'20',safesearch:'moderate'}),{headers:{Accept:'application/json','X-Subscription-Token':key},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error(`웹 검색 제공자 응답 오류 (${response.status})`);const data=await response.json() as {web?:{results?:Array<{title?:string,url?:string,description?:string}>}};
 return (data.web?.results??[]).flatMap(v=>{if(typeof v.title!=='string'||typeof v.url!=='string'||!safePublicUrl(v.url))return[];return[{id:createHash('sha256').update(v.url).digest('hex').slice(0,24),title:clean(v.title,200),url:v.url,description:clean(v.description??'',500),sourceName:'Brave 웹 검색'}]});
}
async function alioSearch(query:string,key:string,url:string):Promise<WebCandidate[]>{
 const endpoint=new URL(url);if(!['https:'].includes(endpoint.protocol)||!/(^|\.)alio\.go\.kr$/i.test(endpoint.hostname))throw new Error('ALIO API 주소는 alio.go.kr 호스트만 사용할 수 있습니다.');endpoint.searchParams.set('query',query);
 const response=await fetch(endpoint,{headers:{Accept:'application/json,'+' text/plain','Authorization':`Bearer ${key}`},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`ALIO 응답 오류 (${response.status})`);const data=await response.json() as unknown;
 const rows=Array.isArray(data)?data:(data&&typeof data==='object'&&Array.isArray((data as {items?:unknown[]}).items)?(data as {items:unknown[]}).items:[]);
 return rows.flatMap(v=>{if(!v||typeof v!=='object')return[];const x=v as Record<string,unknown>,title=clean(x.title??x.recruitmentName??x.recruitNm,200),link=clean(x.url??x.detailUrl??x.recruitUrl,2000),description=clean(x.description??x.contents??'',500);if(!title||!safePublicUrl(link))return[];return[{id:createHash('sha256').update(link).digest('hex').slice(0,24),title,url:link,description,sourceName:'ALIO 공공기관 채용정보'}]});
}
async function naverEndpoint(kind:NaverKind,query:string,clientId:string,clientSecret:string,page:number,companyName?:string){
 const endpoint=new URL(`https://naverapihub.apigw.ntruss.com/search/v1/${kind==='web'?'webkr':kind}`);
 endpoint.searchParams.set('query',query);endpoint.searchParams.set('display','20');endpoint.searchParams.set('start',String(1+(page-1)*20));endpoint.searchParams.set('format','json');if(kind!=='web')endpoint.searchParams.set('sort','sim');
 const response=await fetch(endpoint,{headers:{'X-NCP-APIGW-API-KEY-ID':clientId,'X-NCP-APIGW-API-KEY':clientSecret,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error(`네이버 API HUB ${kind} 검색 오류 (${response.status})`);
 return parseNaverItems(await response.json(),kind,companyName);
}
async function naverSearch(query:string,clientId:string,clientSecret:string,page:number,companyName?:string){
 const results=await Promise.allSettled((['web','news','blog'] as NaverKind[]).map(kind=>naverEndpoint(kind,query,clientId,clientSecret,page,companyName)));
 const candidates:WebCandidate[]=[],warnings:string[]=[];results.forEach((result,index)=>{if(result.status==='fulfilled')candidates.push(...result.value);else warnings.push(`네이버 ${(['웹문서','뉴스','블로그'] as const)[index]} 검색에 실패했습니다.`)});
 const unique=candidates.filter((candidate,index,array)=>array.findIndex(other=>normalizedPostingUrl(other.url)===normalizedPostingUrl(candidate.url))===index);
 return {candidates:unique,warnings};
}
type TavilySearchRow={title?:unknown;url?:unknown;content?:unknown;raw_content?:unknown};
async function tavilyExtract(urls:string[],query:string,key:string){
 if(!urls.length)return new Map<string,string>();
 const response=await fetch('https://api.tavily.com/extract',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({urls,query,chunks_per_source:3,extract_depth:'basic',format:'text',include_usage:false}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Tavily 본문 추출 오류 (${response.status})`);
 const data=await response.json() as {results?:Array<{url?:unknown;raw_content?:unknown}>};const map=new Map<string,string>();
 for(const row of data.results??[]){if(typeof row.url==='string'&&typeof row.raw_content==='string')map.set(normalizedPostingUrl(row.url),row.raw_content)}
 return map;
}
async function tavilySearch(query:string,key:string,companyName?:string){
 const response=await fetch('https://api.tavily.com/search',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({query:`${query} 채용 공고 모집기간`,search_depth:'basic',max_results:8,include_answer:false}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Tavily 검색 오류 (${response.status})`);
 const data=await response.json() as {results?:TavilySearchRow[]};const base=(data.results??[]).flatMap(row=>{const c=webCandidateFromParts({title:row.title,url:row.url,description:row.content,sourceName:'Tavily 웹 검색',sourceType:'tavily',companyName});return c?[c]:[]});
 const extractionUrls=base.slice(0,5).map(c=>c.url);let extracted=new Map<string,string>(),warning:string|undefined;
 try{extracted=await tavilyExtract(extractionUrls,query,key)}catch{warning='Tavily 검색 결과의 본문 추출에 실패했습니다. 검색 요약은 유지합니다.'}
 const candidates=base.map(c=>{const content=extracted.get(normalizedPostingUrl(c.url));if(!content)return c;const period=extractRecruitmentPeriod([c.title,c.description,content].join(' '));return {...c,extractedContent:cleanRich(content,1800),start:period?.start??c.start??null,end:period?.end??c.end??null,dateEvidence:period?`본문에서 확인한 접수기간: ${period.evidence}`:c.dateEvidence}});
 return {candidates,warnings:warning?[warning]:[]};
}
export function fallbackQueryForInstitution(query:string,institution?:Institution){
 if(!institution)return query;
 const normalized=query.replace(/\s+/g,' ').trim();
 if(/하반기|신입|신입행원|채용|공채/i.test(normalized))return normalized;
 const focus=institution.id==='shinhan'?'신입행원':institution.id==='fss'?'5급 종합직원':'채용';
 return `${normalized} 2026 하반기 ${focus}`.replace(/\s+/g,' ').trim();
}
export async function searchJobs(query:string,page=1,config:SearchConfig={}):Promise<SearchResult>{
 if(!Number.isSafeInteger(page)||page<1||page>MAX_PAGES)throw new Error('조회 페이지를 확인해주세요.');
 const warnings:string[]=[],candidates:Candidate[]=[];let bank=resolveBank(query),institution=resolveInstitution(query),targetUrl:string|undefined;
 if(/^https?:\/\//i.test(query)){
   const u=new URL(query);if(u.protocol!=='https:'||u.port||u.username||u.password)throw new Error('HTTPS 공식 공고 주소를 입력해주세요.');targetUrl=u.href;
   const directOfficialHost=['recruit.kdb.co.kr','im.recruiter.co.kr','shinhan.recruiter.co.kr','www.fss.or.kr'].includes(u.hostname);
   if(u.hostname==='kbstar.careerlink.kr')bank=BANKS[0];else if(['ibk.incruit.com','ibk3.incruit.com','ibk4.incruit.com'].includes(u.hostname))bank=BANKS[1];else if(u.hostname==='nhbank.incruit.co.kr')bank=BANKS[2];else if(u.hostname==='nhbank.incruit.com')bank=BANKS[2];else if(u.hostname!=='job.incruit.com'&&!directOfficialHost&&u.href!==WOORI_ARCHIVE_URL){if(!safePublicUrl(u.href))throw new Error('공개 HTTPS 공고 주소를 확인해주세요.');return{query:u.href,candidates:[],uncertainCandidates:[],warnings:['이 주소는 자동 해석을 지원하지 않습니다. 입력한 URL을 보존해 직접 등록하세요.'],total:0,scanned:0,manualUrl:u.href,failed:false};}
    if(u.hostname==='job.incruit.com'){
    try{const c=await incruitDetail(u.href);const verified=verifiedCandidates([c]),uncertain=uncertainCandidates([c]);return{query:u.href,candidates:verified,uncertainCandidates:uncertain,warnings:verified.length||uncertain.length?[]:['원문에서 2026년 하반기 접수 시작일을 확인하지 못했습니다. URL을 보존해 직접 등록할 수 있습니다.'],total:1,scanned:1,manualUrl:verified.length||uncertain.length?undefined:u.href};}catch{return{query:u.href,candidates:[],uncertainCandidates:[],warnings:['인크루트 공고를 자동 해석하지 못했습니다. 입력한 URL을 보존해 직접 등록하세요.'],total:0,scanned:0,manualUrl:u.href,failed:false};}
    }
   const directInstitution=resolveInstitution(u.hostname==='recruit.kdb.co.kr'?'산업은행':u.hostname==='im.recruiter.co.kr'?'iM뱅크':u.hostname==='shinhan.recruiter.co.kr'?'신한은행':u.hostname==='www.fss.or.kr'?'금융감독원':'');
   if(directInstitution){try{const c=await genericOfficialDetail(u.href,directInstitution.name),verified=verifiedCandidates([c]),uncertain=uncertainCandidates([c]);return{query:u.href,candidates:verified,uncertainCandidates:uncertain,warnings:verified.length||uncertain.length?[]:['공식 원문에서 2026년 하반기 접수 시작일을 확인하지 못했습니다. URL을 보존해 직접 등록할 수 있습니다.'],total:1,scanned:1,manualUrl:verified.length||uncertain.length?undefined:u.href};}catch{return{query:u.href,candidates:[],uncertainCandidates:[],warnings:['공식 채용 공고를 자동 해석하지 못했습니다. 입력한 URL을 보존해 직접 등록하세요.'],total:0,scanned:0,manualUrl:u.href,failed:false};}}
   if(!safePublicUrl(u.href))throw new Error('공개 HTTPS 공고 주소를 확인해주세요.');
 }
 const entity=bank??institution;const queryText=entity?queryForEntity(query,entity):targetUrl===WOORI_ARCHIVE_URL?'우리은행':query;
 const isWoori=/우리\s*은행|woori/i.test(queryText),requests:Promise<unknown>[]=[publicSearchPage(queryText,page)];
 if(bank&&page===1)requests.push(bankSearch(bank.id));if(isWoori&&page===1)requests.push(wooriArchive());
 const results=await Promise.allSettled(requests);let total=0,hasMore=false,partial=false,success=0;
 if(results[0].status==='fulfilled'){const r=results[0].value as PublicPage;candidates.push(...r.candidates);total=r.total;hasMore=r.hasMore;partial=r.partial;success++;if(partial)warnings.push('공개 검색 API가 응답하지 않아 첫 공개 페이지를 확인했습니다. 추가 조회가 실패할 수 있으며 전체 검색 결과가 아닙니다.');}
 else warnings.push(page===1?'일부 공개 채용 소스가 응답하지 않아 확인 가능한 결과와 네이버 보완 결과를 함께 표시합니다.':'추가 페이지 조회에 실패했습니다. 기존 결과를 유지했습니다. 잠시 후 다시 불러와 주세요.');
 let index=1;if(bank&&page===1){const r=results[index++];if(r.status==='fulfilled'){const v=r.value as Awaited<ReturnType<typeof bankSearch>>;candidates.push(...v.candidates);success++;if(v.warning)warnings.push(v.warning)}else warnings.push('은행 공식 목록 조회에 실패했습니다.');}
 if(isWoori&&page===1){const r=results[index];if(r.status==='fulfilled'){candidates.push(r.value as Candidate);success++}else warnings.push('우리은행 공식 마감 공고 원문 조회에 실패했습니다.');}
 const related=candidates.filter(c=>!institution||institutionMatches(c.companyName,institution));
 if(institution&&candidates.length&&!related.length)warnings.push(`${institution.name}과 고용주명이 정확히 일치하는 결과가 없어 관련 결과를 숨겼습니다. 공식 경로 또는 URL 등록을 이용하세요.`);
 const scoped=institution&&related.length?related:institution?[]:candidates;
 const unique=verifiedCandidates(scoped).filter((c,i,a)=>a.findIndex(x=>normalizedPostingUrl(x.url)===normalizedPostingUrl(c.url))===i).filter(c=>!targetUrl||normalizedPostingUrl(c.url)===normalizedPostingUrl(targetUrl));
 const uncertain=uncertainCandidates(scoped).filter((c,i,a)=>a.findIndex(x=>normalizedPostingUrl(x.url)===normalizedPostingUrl(c.url))===i).filter(c=>!targetUrl||normalizedPostingUrl(c.url)===normalizedPostingUrl(targetUrl));
 let webCandidates:WebCandidate[]|undefined;const webWarnings:string[]=[];
 // 기관 검색은 공개 채용 결과가 많아도 특정 회차 공고가 누락될 수 있다.
 // 따라서 첫 페이지에서는 기관별 보완 검색을 항상 실행한다.
 const needsWebFallback=page===1&&(success===0||unique.length<3||!!institution);
 const fallbackQuery=fallbackQueryForInstitution(queryText,institution);
 if(needsWebFallback&&config.naverClientId&&!config.naverClientSecret)webWarnings.push('네이버 검색은 Client ID와 Client Secret이 모두 필요합니다.');
 if(needsWebFallback&&config.naverClientSecret&&!config.naverClientId)webWarnings.push('네이버 검색은 Client ID와 Client Secret이 모두 필요합니다.');
 if(needsWebFallback&&config.naverClientId&&config.naverClientSecret){try{const r=await naverSearch(fallbackQuery,config.naverClientId,config.naverClientSecret,page,entity?.name);webCandidates=[...(webCandidates??[]),...r.candidates];webWarnings.push(...r.warnings)}catch{webWarnings.push('네이버 검색 조회에 실패했습니다. 공식·공개 결과는 유지됩니다.')}}
 if(needsWebFallback&&config.tavilyApiKey){try{const r=await tavilySearch(fallbackQuery,config.tavilyApiKey,entity?.name);webCandidates=[...(webCandidates??[]),...r.candidates];webWarnings.push(...r.warnings)}catch{webWarnings.push('Tavily 검색 조회에 실패했습니다. 공식·공개 결과는 유지됩니다.')}}
 if(needsWebFallback&&config.braveApiKey){try{webCandidates=[...(webCandidates??[]),...(await externalWebSearch(fallbackQuery,config.braveApiKey))]}catch{webWarnings.push('Brave 웹 검색 조회에 실패했습니다. 공식·공개 결과는 유지됩니다.')}}
 if(needsWebFallback&&config.alioApiKey&&config.alioApiUrl){try{webCandidates=[...(webCandidates??[]),...(await alioSearch(fallbackQuery,config.alioApiKey,config.alioApiUrl))]}catch{webWarnings.push('ALIO 조회에 실패했습니다. 공식·공개 결과는 유지됩니다.')}}
 if(page===1&&institution)webCandidates=[...(webCandidates??[]),...officialPathCandidates(institution).filter(c=>!(webCandidates??[]).some(x=>normalizedPostingUrl(x.url)===normalizedPostingUrl(c.url)))];
 warnings.push(...webWarnings);
 if(page===MAX_PAGES&&hasMore)warnings.push('공개 검색 후보 500개까지 확인했습니다. 검색어를 구체화해 주세요.');
 const manualUrl=targetUrl&&unique.length===0&&uncertain.length===0?targetUrl:undefined;if(manualUrl)warnings.push('공식 목록에서 같은 주소를 다시 찾지 못했습니다. 입력한 URL을 보존해 직접 등록하세요.');
 return {query:queryText,candidates:unique,uncertainCandidates:uncertain,webCandidates,warnings,total,scanned:candidates.length,partial:partial||hasMore,failed:success===0&&!(webCandidates?.length),nextPage:hasMore&&page<MAX_PAGES?page+1:null,manualUrl};
}
export async function resolveSelection(s:Selection):Promise<Candidate>{
 if(!s||typeof s.query!=='string'||s.query.length>2000||typeof s.id!=='string')throw new Error('공고 선택 정보를 확인해주세요.');
 const page=s.page??1;if(!Number.isSafeInteger(page)||page<1||page>MAX_PAGES)throw new Error('공고 페이지를 확인해주세요.');
 const candidates=s.provider==='web-source'?[await enrichWebCandidate(s.query,s.companyName??'')]:s.provider==='woori-archive'?[await wooriArchive()]:s.provider==='incruit'&&/^https:\/\/job\.incruit\.com\//i.test(s.query)?[await incruitDetail(s.query)]:s.provider==='official-url'?[await genericOfficialDetail(s.query,resolveInstitution(new URL(s.query).hostname==='recruit.kdb.co.kr'?'산업은행':new URL(s.query).hostname==='im.recruiter.co.kr'?'iM뱅크':new URL(s.query).hostname==='shinhan.recruiter.co.kr'?'신한은행':'금융감독원')?.name??'공식 기관')]:s.provider==='incruit'?(await publicSearchPage(s.query,page)).candidates:(await bankSearch(s.provider)).candidates;
 const found=[...verifiedCandidates(candidates),...uncertainCandidates(candidates)].find(c=>c.id===s.id&&c.provider===s.provider);if(!found)throw new Error('공고 원문을 다시 확인하지 못했습니다. 다시 검색해주세요.');return found;
}
