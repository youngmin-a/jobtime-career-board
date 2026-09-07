import { readStore, updateStore } from "@/lib/store";
import { BANKS, validPoint, pointMs, type DatePoint, type Posting } from "@/lib/jobs";
import { allowMutation, failure } from "@/lib/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() { try{return Response.json(await readStore());}catch(e){return failure(e,500);} }
export async function POST(request:Request) {
  try {
    allowMutation(request);
    const body=await request.text();if(body.length>20000)throw new Error("입력 내용이 너무 깁니다.");
    const input=JSON.parse(body);
    const state=await updateStore(state=>{
      if(input.action==="add-selected") {
        const bank=BANKS.find(b=>b.id===input.provider);if(!bank)throw new Error("지원하지 않는 공식 채용 사이트입니다.");
        const candidate=input.posting as Posting;if(!candidate||typeof candidate!=="object"||typeof candidate.id!=="string"||typeof candidate.title!=="string"||candidate.title.length>200)throw new Error("선택한 공고 정보를 확인해주세요.");
        const url=new URL(candidate.url);const allowed=bank.id==="kb"?url.hostname==="kbstar.careerlink.kr":bank.id==="nh"?url.hostname==="nhbank.incruit.com":["ibk.incruit.com","ibk3.incruit.com","ibk4.incruit.com"].includes(url.hostname);
        if(url.protocol!=="https:"||!allowed||!validPoint(candidate.start)||!validPoint(candidate.end))throw new Error("공식 공고 정보를 확인해주세요.");
        if(!state.companies.some(c=>c.id===bank.id))state.companies.push({id:bank.id,name:bank.name,provider:bank.id});
        if(state.postings.some(p=>p.id===candidate.id))throw new Error("이미 추가한 공고입니다.");
        state.postings.push({...candidate,companyId:bank.id,source:bank.scope,kind:"official",saved:true,stage:"관심",notes:""});
      }else if(input.action==="remove-posting") {
        const before=state.postings.length;state.postings=state.postings.filter(p=>p.id!==input.id);if(before===state.postings.length)throw new Error("공고를 찾지 못했습니다.");
        state.companies=state.companies.filter(c=>state.postings.some(p=>p.companyId===c.id));
      }else if(input.action==="update-posting") {
        const p=state.postings.find(p=>p.id===input.id);if(!p)throw new Error("공고를 찾지 못했습니다.");
        if(typeof input.saved==="boolean")p.saved=input.saved;
        if(input.stage!==undefined) {if(!["관심","지원 준비","지원 완료"].includes(input.stage))throw new Error("올바른 지원 상태를 선택해주세요.");p.stage=input.stage;}
        if(input.notes!==undefined) {if(typeof input.notes!=="string"||input.notes.length>2000)throw new Error("메모는 2,000자까지 입력할 수 있습니다.");p.notes=input.notes;}
      }else if(input.action==="add-posting") {
        if(!state.companies.some(c=>c.id===input.companyId))throw new Error("기업을 선택해주세요.");
        if(typeof input.title!=="string" || !input.title.trim() || input.title.length>200)throw new Error("공고 제목을 1~200자로 입력해주세요.");
        if(typeof input.url!=="string" || input.url.length>2000)throw new Error("공고 주소를 입력해주세요.");
        const url=new URL(input.url);if(url.protocol!=="https:"||url.username||url.password)throw new Error("https로 시작하는 공고 주소를 입력해주세요.");
        for(const key of ["start","end"] as const) {
          const point=input[key] as DatePoint|null;
          if(point!==null && (!point || typeof point!=="object" || typeof point.date!=="string"))throw new Error("날짜 입력을 확인해주세요.");
          if(!validPoint(point))throw new Error("유효한 날짜와 시간을 입력해주세요.");
        }
        if(input.start&&input.end&&(input.start.date>input.end.date||input.start.time&&input.end.time&&pointMs(input.start)>pointMs(input.end)))throw new Error("마감일시는 시작일시보다 늦어야 합니다.");
        if(state.postings.some(p=>p.companyId===input.companyId&&p.url===url.href))throw new Error("이미 등록된 공고 주소입니다.");
        const p:Posting={id:crypto.randomUUID(),companyId:input.companyId,title:input.title.trim(),url:url.href,start:input.start,end:input.end,source:"직접 입력",evidence:"사용자가 직접 입력한 일정입니다. 공식 원문과 대조해주세요.",checkedAt:new Date().toISOString(),kind:"manual",saved:true,stage:"관심",notes:""};
        state.postings.push(p);
      }else throw new Error("지원하지 않는 요청입니다.");
      return state;
    });
    return Response.json(state);
  }catch(e){return failure(e);}
}
