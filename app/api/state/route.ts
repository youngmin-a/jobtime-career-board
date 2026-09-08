import {allowMutation} from "@/lib/http";
import {Conflict} from "@/lib/repository";
import {addWorkspaceHeaders,storeForRequest} from "@/lib/store";
import {validateApplication,fromOfficial,officialCompany,type Application} from "@/lib/applications";
import {fetchCompany} from "@/lib/providers";
import {resolveSelection} from "@/lib/search";
import {candidateApplication} from "@/lib/search-types";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const {context,repository}=await storeForRequest(request);
  try{return addWorkspaceHeaders(Response.json(await repository.read()),context)}
  catch{return addWorkspaceHeaders(Response.json({error:"저장 데이터를 읽지 못했습니다. 기존 데이터는 보존됩니다."},{status:500}),context)}
}

export async function POST(request:Request){
  const {context,repository}=await storeForRequest(request);
  try{
    allowMutation(request);
    const raw=await request.text();
    if(raw.length>500000)throw new Error("입력 크기가 너무 큽니다.");
    const input=JSON.parse(raw);
    if(!Number.isSafeInteger(input.revision))throw new Error("저장 버전을 확인해주세요.");
    let official:Application|undefined;
    if(input.action==='save-selected'){
      const trusted=candidateApplication(await resolveSelection(input.selection));
      const draft:Application=input.application;
      validateApplication(draft);
      official={...draft,origin:trusted.origin,provider:trusted.provider,sourceName:trusted.sourceName,officialPostingId:trusted.officialPostingId,officialRecruitmentSnapshot:trusted.officialRecruitmentSnapshot,evidence:trusted.evidence,officialCheckedAt:trusted.officialCheckedAt,createdAt:trusted.createdAt,recruitmentOrigin:JSON.stringify(draft.recruitment)===JSON.stringify(trusted.recruitment)?trusted.origin:'user_override'};
    }
    if(input.action==='add-selected'){
      const bank=officialCompany(input.provider);if(!bank)throw new Error("지원하지 않는 공식 출처입니다.");
      const result=await fetchCompany({id:bank.id,name:bank.name,provider:bank.id});
      const found=result.postings.find(p=>p.id===input.postingId);if(!found)throw new Error("공식 공고가 변경되었습니다. 다시 검색해주세요.");
      official=fromOfficial(found,bank.name,bank.id);
    }
    const backup=input.action==="restore-backup"?await (async()=>{if(input.confirm!=="RESTORE"||typeof input.backupId!=="string"||input.backupId.length>100)throw new Error("복구 대상과 확인 값을 입력해주세요.");return repository.backup(input.backupId)})():null;
    const state=await repository.update(input.revision,state=>{
      if(backup){state.applications=backup.applications;return state}
      if(input.action==="delete"){if(!state.applications.some(a=>a.id===input.id))throw new Error("공고를 찾지 못했습니다.");state.applications=state.applications.filter(a=>a.id!==input.id);return state}
      if(!["save","add-selected","save-selected"].includes(input.action))throw new Error("지원하지 않는 요청입니다.");
      const a:Application=official??input.application;
      validateApplication(a);
      const index=state.applications.findIndex(p=>p.id===a.id),existing=state.applications[index];
      if(input.action==='save-selected'&&existing)throw new Error("이미 등록된 공고입니다. 내 공고에서 수정해주세요.");
      if(!existing&&state.applications.some(p=>(a.postingUrl&&p.postingUrl===a.postingUrl)||(p.companyName.trim()===a.companyName.trim()&&p.postingTitle.trim()===a.postingTitle.trim()))&&!input.allowDuplicate)throw new Error("DUPLICATE:비슷한 공고가 있습니다. 별도 차수·직무라면 중복 등록을 허용하세요.");
      if(existing){
        a.origin=existing.origin;a.sourceName=existing.sourceName;a.provider=existing.provider;a.officialPostingId=existing.officialPostingId;a.evidence=existing.evidence;a.officialCheckedAt=existing.officialCheckedAt;a.officialRecruitmentSnapshot=existing.officialRecruitmentSnapshot;a.createdAt=existing.createdAt;
        a.recruitmentOrigin=existing.origin!=="manual"?(JSON.stringify(a.recruitment)===JSON.stringify(existing.officialRecruitmentSnapshot)?existing.origin:"user_override"):"manual";
      }else if(!official){
        a.origin="manual";a.sourceName=undefined;a.provider=null;a.officialPostingId=null;a.evidence=null;a.officialCheckedAt=null;a.officialRecruitmentSnapshot=null;a.recruitmentOrigin="manual";a.createdAt=new Date().toISOString();
      }
      a.updatedAt=new Date().toISOString();
      if(index<0)state.applications.push(a);else state.applications[index]=a;
      return state;
    });
    return addWorkspaceHeaders(Response.json(state),context);
  }catch(e){const message=e instanceof Error?e.message:"저장 실패";return addWorkspaceHeaders(Response.json({error:message},{status:e instanceof Conflict?409:400}),context)}
}
