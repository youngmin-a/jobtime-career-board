import { load } from "cheerio";
import { createHash } from "node:crypto";
import { BANKS, parsePeriod, validPoint, type Company, type DatePoint, type Posting } from "./jobs";

const allowedHosts = new Set(["kbstar.careerlink.kr","api.inhr.co.kr","ibk.incruit.com","ibk3.incruit.com","ibk4.incruit.com","nhbank.incruit.com","jlab.incruit.com","jrs.jobkorea.co.kr"]);
export async function publicFetch(url: string, init: RequestInit = {}) {
  // 요청 대상은 검증한 공식 출처에 한정한다. 사용자 입력 URL을 서버가 임의로 방문하지 않는다.
  let next = new URL(url);
  for(let hop=0; hop<4; hop++) {
    if (next.protocol !== "https:" || !allowedHosts.has(next.hostname) || next.port || next.username || next.password) throw new Error("지원하지 않는 출처입니다.");
    const response = await fetch(next,{...init,redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(15000)});
    if (response.status >= 300 && response.status < 400) {
      const location=response.headers.get("location");
      if(!location) throw new Error("출처 페이지 이동을 확인하지 못했습니다.");
      next=new URL(location,next); continue;
    }
    if(!response.ok) throw new Error(`공식 사이트 응답 오류 (${response.status}). 잠시 후 다시 확인해주세요.`);
    const reader=response.body?.getReader();
    if(!reader) throw new Error("공식 사이트 응답이 비어 있습니다.");
    const chunks: Uint8Array[]=[];let size=0;
    while(true) { const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>3_000_000){await reader.cancel();throw new Error("공식 페이지가 너무 커서 자동 조회를 중단했습니다.");}chunks.push(value); }
    const body=Buffer.concat(chunks);
    return {body,headers:response.headers};
  }
  throw new Error("공식 사이트 이동 횟수가 초과됐습니다.");
}
function html(result: {body:Buffer;headers:Headers}) {
  const hint=result.headers.get("content-type")+result.body.subarray(0,1500).toString("ascii");
  return new TextDecoder(/euc-kr|ks_c_5601|cp949/i.test(hint)?"euc-kr":"utf-8").decode(result.body);
}
const clean=(s:string)=>s.replace(/\s+/g," ").trim();
function record(company:Company,title:string,url:string,start:DatePoint|null,end:DatePoint|null,evidence:string):Posting {
  return {id:createHash("sha256").update(company.id+url).digest("hex").slice(0,24),companyId:company.id,title:clean(title),url,start,end,source:BANKS.find(b=>b.id===company.provider)!.scope,evidence,checkedAt:new Date().toISOString(),kind:"official",saved:false,stage:"관심",notes:""};
}
export function parseKb(data: unknown, company:Company) {
  const value=data as {code?:string; data?:{rcrtList?:Record<string,unknown>[]}};
  if(value.code!=="0000" || !Array.isArray(value.data?.rcrtList))throw new Error("국민은행 공고 목록 형식이 변경되었습니다. 공식 사이트를 확인해주세요.");
  // 공개 범위만 제한하고 상태는 열림/마감을 모두 보존한다. 검색 단계에서 2026년 하반기만 분류한다.
  return value.data.rcrtList.filter(v=>v.rcrtOpblScopGbcd==="01").map(v=> {
    function date(raw:unknown):DatePoint|null {
      if(typeof raw!=="string")return null;
      const m=raw.match(/^(20\d{2}-\d{2}-\d{2}) (\d{2}:\d{2}):(\d{2})$/);
      const p=m?{date:m[1],time:m[2],second:Number(m[3])}:null;
      return validPoint(p)?p:null;
    }
    const start=date(v.rcrtAcptStrtDtm),end=date(v.rcrtAcptEndDtm);
    if(typeof v.rcrtNo!=="string" || !/^RC\d+$/.test(v.rcrtNo) || typeof v.rcrtNm!=="string")throw new Error("국민은행 공고 식별 정보를 확인하지 못했습니다.");
    return record(company,v.rcrtNm,`https://kbstar.careerlink.kr/jobs/${v.rcrtNo}`,start,end,`공식 접수기간: ${String(v.rcrtAcptStrtDtm??"미공개")} ~ ${String(v.rcrtAcptEndDtm??"미공개")} (한국시간)`);
  });
}
async function kb(company:Company) {
  const homepage=html(await publicFetch("https://kbstar.careerlink.kr/"));
  const $=load(homepage), data=JSON.parse($("#__NEXT_DATA__").text());
  const coNo=data.props?.pageProps?.middlewareData?.companyDataFromSubdomain?.coInf?.coNo;
  if(typeof coNo!=="string" || !/^CO\d+$/.test(coNo))throw new Error("국민은행 공식 기업 정보를 확인하지 못했습니다.");
  const response=await publicFetch("https://api.inhr.co.kr/v1/recruit/jd/list",{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://kbstar.careerlink.kr",Referer:"https://kbstar.careerlink.kr/"},body:JSON.stringify({coNo})});
  return {postings:parseKb(JSON.parse(response.body.toString("utf8")),company),warning:"신입 채용 사이트 기준입니다. 별도 전문직·파트타이머 채용은 포함되지 않습니다."};
}
export function parseNh(source:string,company:Company) {
  const $=load(source),posts:Posting[]=[];
  $("a[href*='viewhire.asp']").each((_,element)=> {
    const a=$(element),href=a.attr("href"); if(!href)return;
    const url=new URL(href,"https://nhbank.incruit.com/");
    if(url.hostname!=="nhbank.incruit.com")return;
    const date=a.find(".nh-visual__cta-date").text();
    const title=clean(a.find(".nh-visual__cta-info").text());
    if(!date || !title)return;
    const period=parsePeriod(date);
    if(!period)throw new Error("농협은행 접수기간 형식이 변경되었습니다. 공식 공고를 확인해주세요.");
    posts.push(record(company,title,url.href,period.start,period.end,period.evidence));
  });
  if(!posts.length)throw new Error("농협은행 현재 메인 공고를 자동으로 읽지 못했습니다. 공고가 없거나 페이지 형식이 바뀌었을 수 있습니다.");
  return posts;
}
export function parseIbkDetail(source:string) {
  const $=load(source); $("script,style,nav,header,footer").remove();
  const text=clean($.root().text());
  if(text.includes("잘못된 경로"))throw new Error("기업은행 공고 연결을 확인하지 못했습니다.");
  const anchors=[/채용공고\s*게시\s*및\s*서류접수\s*[:：]?/g,/입행지원서\s*접수\s*기간\s*[:：]?/g,/입사지원서\s*접수\s*[:：]?/g,/접수기간\s*[:：]?/g,/접수\s*기간\s*[:：]?/g];
  for(const pattern of anchors) {
    for(const match of text.matchAll(pattern)) {
      const period=parsePeriod(text.slice((match.index??0)+match[0].length,(match.index??0)+match[0].length+140));
      if(period)return period;
    }
  }
  return null;
}
async function ibk(company:Company) {
  const landing=await publicFetch("https://ibk.incruit.com/");
  const cookie=(landing.headers.getSetCookie?.()??[]).map(v=>v.split(";")[0]).join("; ");
  let source=html(landing);
  if(!source.includes("viewhire.asp"))source=html(await publicFetch("https://ibk.incruit.com/index_main_2025.asp",{headers:{Cookie:cookie}}));
  const $=load(source), links=new Map<string,string>();
  $("a[href*='viewhire.asp']").each((_,el)=>{
    const a=$(el),href=a.attr("href");if(!href)return;
    const url=new URL(href,"https://ibk.incruit.com/");url.protocol="https:";
    if(!["ibk.incruit.com","ibk3.incruit.com","ibk4.incruit.com"].includes(url.hostname))return;
    const title=clean(a.text()); if(title)links.set(url.href,title);
  });
  if(!links.size)throw new Error("기업은행 공고 목록 형식이 변경되었습니다. 공식 사이트를 확인해주세요.");
  const errors:string[]=[];
  const postings:Posting[]=[];
  for(const [url,title] of [...links].slice(0,12)) {
    try {
      const host=new URL(url).origin;
      let sessionCookie=cookie;
      if(host!=="https://ibk.incruit.com") {
        const response=await publicFetch(host+"/");
        sessionCookie=(response.headers.getSetCookie?.()??[]).map(v=>v.split(";")[0]).join("; ");
      }
      const detail=html(await publicFetch(url,{headers:{Cookie:sessionCookie,Referer:host+"/"}}));
      const period=parseIbkDetail(detail);
      postings.push(record(company,title,url,period?.start??null,period?.end??null,period?.evidence??"접수기간을 자동으로 확인하지 못했습니다. 공식 원문에서 확인해주세요."));
    } catch { errors.push(title); }
  }
  if(!postings.length)throw new Error("기업은행 공고를 가져오지 못했습니다. 저장된 공고는 유지됩니다.");
  const warning=errors.length?`${errors.length}개 공고 상세 조회 실패. 해당 공고는 공식 사이트에서 확인해주세요.`:postings.some(p=>!p.end)?"일부 공고는 일정 자동 확인이 필요합니다. 날짜가 없는 공고도 목록에서 확인하세요.":undefined;
  return {postings,warning};
}
export async function fetchCompany(company:Company) {
  if(company.provider==="kb")return kb(company);
  if(company.provider==="nh")return {postings:parseNh(html(await publicFetch("https://nhbank.incruit.com/main/index.asp")),company),warning:"신규직원 채용 메인 공고 기준입니다. 범농협 수시 채용은 포함되지 않습니다."};
  if(company.provider==="ibk")return ibk(company);
  throw new Error("이 기업은 아직 자동 조회를 지원하지 않습니다. 공고를 직접 추가할 수 있습니다.");
}
