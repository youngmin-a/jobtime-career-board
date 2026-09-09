import { BANKS, validPoint, pointMs, kstDate, type DatePoint, type Posting, type Store } from "./jobs";
import type {SearchBasis} from './search-scope';

export const managementLabels = {interested:"관심",preparing:"지원 준비",active:"지원 중",accepted:"최종합격",rejected:"불합격",withdrawn:"지원 철회"} as const;
export const stageLabels = {not_started:"미진행",scheduled:"예정",in_progress:"진행 중",completed:"완료",passed:"합격",failed:"불합격",not_applicable:"해당 없음"} as const;
export type ManagementStatus=keyof typeof managementLabels;
export type StageStatus=keyof typeof stageLabels;
export type Point=DatePoint & {timezone:"Asia/Seoul"};
export type Range={start:Point|null;end:Point|null;tentative:boolean};
export type Stage={id:string;name:string;order:number;status:StageStatus;applicable:boolean;schedule:Range;resultExpectedAt:Point|null;resultConfirmedAt:Point|null;notes:string};
export type PersonalEvent={id:string;title:string;schedule:Range;notes:string};
export type Application={id:string;companyName:string;postingTitle:string;role:string;employmentType:string;postingUrl:string|null;origin:"official"|"public"|"manual";sourceName?:string;searchBasis?:SearchBasis;discoveredBy?:string;discoveryUrl?:string;provider:string|null;officialPostingId:string|null;recruitment:Range;recruitmentOrigin:"official"|"public"|"manual"|"user_override";officialRecruitmentSnapshot:Range|null;evidence:string|null;officialCheckedAt:string|null;managementStatus:ManagementStatus;currentStageId:string|null;notes:string;stages:Stage[];personalEvents:PersonalEvent[];createdAt:string;updatedAt:string};
export type State={version:2;revision:number;applications:Application[]};
export const emptyRange=():Range=>({start:null,end:null,tentative:false});
export function newStage(name:string,order:number):Stage{return{id:crypto.randomUUID(),name,order,status:"not_started",applicable:true,schedule:emptyRange(),resultExpectedAt:null,resultConfirmedAt:null,notes:""}}
export function newApplication():Application {const now=new Date().toISOString();return{id:crypto.randomUUID(),companyName:"",postingTitle:"",role:"",employmentType:"",postingUrl:null,origin:"manual",provider:null,officialPostingId:null,recruitment:emptyRange(),recruitmentOrigin:"manual",officialRecruitmentSnapshot:null,evidence:null,officialCheckedAt:null,managementStatus:"interested",currentStageId:null,notes:"",stages:["서류 제출","AI 역량검사","필기 전형","1차 면접","2차 면접","최종면접"].map(newStage),personalEvents:[],createdAt:now,updatedAt:now}}
export const point=(p:DatePoint|null):Point|null=>p?{...p,timezone:"Asia/Seoul"}:null;
export function fromOfficial(p:Posting,companyName:string,provider:string):Application {const a=newApplication();return{...a,companyName,postingTitle:p.title,postingUrl:p.url,origin:"official",provider,officialPostingId:p.id,recruitment:{start:point(p.start),end:point(p.end),tentative:false},recruitmentOrigin:"official",officialRecruitmentSnapshot:{start:point(p.start),end:point(p.end),tentative:false},evidence:p.evidence,officialCheckedAt:p.checkedAt}}
function text(v:unknown,name:string,max:number,required=false):asserts v is string {if(typeof v!=="string"||v.length>max||(required&&!v.trim()))throw new Error(name+"을 확인해주세요.")}
export function validateRange(r:Range){if(!r||typeof r!=="object"||typeof r.tentative!=="boolean")throw new Error("일정 형식이 올바르지 않습니다.");for(const p of [r.start,r.end])if(p!==null&&(!p||p.timezone!=="Asia/Seoul"||!validPoint(p)))throw new Error("유효한 날짜와 시각을 입력해주세요.");if(r.start&&r.end&&(r.start.date>r.end.date||(r.start.time&&r.end.time&&pointMs(r.start)>pointMs(r.end))))throw new Error("시작 일시는 종료 일시보다 늦을 수 없습니다.")}
export function validateApplication(a:Application){
 if(!a||typeof a!=="object")throw new Error("공고를 확인해주세요.");
 text(a.id,"공고 ID",100,true);text(a.companyName,"기업명",100,true);text(a.postingTitle,"공고명",200,true);text(a.role,"직무",100);text(a.employmentType,"채용 구분",100);text(a.notes,"메모",10000);
 if(!Object.hasOwn(managementLabels,a.managementStatus))throw new Error("지원 상태를 확인해주세요.");
 if(a.postingUrl!==null){text(a.postingUrl,"공고 주소",2000,true);const u=new URL(a.postingUrl);if(u.protocol!=="https:"||u.username||u.password)throw new Error("HTTPS 공고 주소를 입력해주세요.");}
 validateRange(a.recruitment);
 if(!Array.isArray(a.stages)||a.stages.length>40||!Array.isArray(a.personalEvents)||a.personalEvents.length>100)throw new Error("전형 또는 일정 개수가 초과되었습니다.");
 const ids=new Set<string>();
 a.stages.forEach((s,i)=>{text(s.id,"전형 ID",100,true);if(ids.has(s.id))throw new Error("전형 ID가 중복됩니다.");ids.add(s.id);text(s.name,"전형명",100,true);text(s.notes,"전형 메모",10000);if(!Object.hasOwn(stageLabels,s.status)||typeof s.applicable!=="boolean"||s.applicable===(s.status==="not_applicable"))throw new Error("해당 없음 상태와 전형 적용 여부를 확인해주세요.");if(s.order!==i)throw new Error("전형 순서를 확인해주세요.");validateRange(s.schedule);validateRange({start:s.resultExpectedAt,end:null,tentative:true});validateRange({start:s.resultConfirmedAt,end:null,tentative:false});});
 if(a.currentStageId!==null&&!a.stages.some(s=>s.id===a.currentStageId&&s.applicable))throw new Error("현재 전형을 먼저 해제하거나 적용 전형으로 선택해주세요.");
 a.personalEvents.forEach(e=>{text(e.id,"일정 ID",100,true);if(ids.has(e.id))throw new Error("일정 ID가 중복됩니다.");ids.add(e.id);text(e.title,"일정명",200,true);text(e.notes,"일정 메모",10000);validateRange(e.schedule);if(!e.schedule.start&&!e.schedule.end)throw new Error("개인 일정에는 날짜를 하나 이상 입력해주세요.");});
}
export function validateState(s:State){if(s.version!==2||!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.applications)||s.applications.length>500)throw new Error("저장 데이터 형식 오류. 기존 데이터는 보존됩니다.");const ids=new Set();for(const a of s.applications){validateApplication(a);if(ids.has(a.id))throw new Error("공고 ID 중복");ids.add(a.id)}}
export function migrateV1(raw:unknown):State {
 const old=raw as Store;if(!old||old.version!==1||!Array.isArray(old.companies)||!Array.isArray(old.postings))throw new Error("v1 저장 데이터가 손상되었습니다.");
 const applications=old.postings.map(p=>{const c=old.companies.find(c=>c.id===p.companyId);if(!c||!["관심","지원 준비","지원 완료"].includes(p.stage)||!["official","manual"].includes(p.kind))throw new Error("기존 기업 또는 지원 상태를 해석하지 못했습니다.");const a=fromOfficial(p,c.name,c.provider??"");a.id=p.id;a.origin=p.kind;a.provider=c.provider;a.recruitmentOrigin=p.kind;a.notes=p.notes;a.managementStatus=p.stage==="지원 완료"?"active":p.stage==="지원 준비"?"preparing":"interested";if(p.stage==="지원 완료")a.stages[0].status="completed";if(p.kind==="manual"){a.officialPostingId=null;a.officialRecruitmentSnapshot=null;a.officialCheckedAt=null}return a});
 const state:State={version:2,revision:0,applications};validateState(state);return state;
}
export const eventLabels={recruitment_start:"모집 시작",recruitment_deadline:"모집 마감",exam:"시험",interview:"면접",stage:"전형",result_expected:"결과 예정",result_confirmed:"결과 확인",personal:"개인 일정"} as const;
export type EventType=keyof typeof eventLabels;
export type CalendarEvent={id:string;applicationId:string;stageId:string|null;personalId:string|null;companyName:string;postingTitle:string;title:string;type:EventType;schedule:Range};
export function calendarEvents(applications:Application[]):CalendarEvent[]{const out:CalendarEvent[]=[];for(const a of applications){const add=(type:EventType,title:string,schedule:Range,stageId:string|null=null,personalId:string|null=null)=>{if(schedule.start||schedule.end)out.push({id:[a.id,type,stageId,personalId].join(":"),applicationId:a.id,stageId,personalId,companyName:a.companyName,postingTitle:a.postingTitle,title,type,schedule})};const r=a.recruitment;add("recruitment_start","모집 시작",{...r,end:null});add("recruitment_deadline","모집 마감",{...r,start:r.end,end:null});for(const s of a.stages.filter(s=>s.applicable)){add(s.name.includes("면접")?"interview":/필기|검사|시험/.test(s.name)?"exam":"stage",s.name,s.schedule,s.id);add("result_expected",s.name+" 결과 예정",{start:s.resultExpectedAt,end:null,tentative:true},s.id);add("result_confirmed",s.name+" 결과 확인",{start:s.resultConfirmedAt,end:null,tentative:false},s.id)}for(const e of a.personalEvents)add("personal",e.title,e.schedule,null,e.id)}return out.sort((a,b)=>eventDate(a).localeCompare(eventDate(b))||(a.schedule.start?.time??"").localeCompare(b.schedule.start?.time??""))}
export const eventDate=(e:CalendarEvent)=>(e.schedule.start??e.schedule.end)!.date;
export function isUpcoming(e:CalendarEvent,now=Date.now()){const p=e.schedule.end??e.schedule.start!;return p.time?pointMs(p)>=now:p.date>=kstDate(now)}
export function eventsOn(events:CalendarEvent[],date:string){return events.filter(e=>{const start=eventDate(e),end=e.schedule.end?.date??start;return start<=date&&end>=date})}
export function addDays(date:string,n:number){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function shiftPoint(p:Point|null,anchor:string,target:string){if(!p)return null;const delta=Math.round((Date.parse(target+"T12:00:00Z")-Date.parse(anchor+"T12:00:00Z"))/86400000);return {...p,date:addDays(p.date,delta)}}
function shiftRange(r:Range,anchor:string,target:string):Range{return{...r,start:shiftPoint(r.start,anchor,target),end:shiftPoint(r.end,anchor,target)}}
export function moveCalendarEvent(application:Application,event:CalendarEvent,targetDate:string):Application{
 const next=structuredClone(application),anchor=eventDate(event);
 if(!validPoint({date:targetDate,time:null}))throw new Error("변경할 날짜를 확인해주세요.");
 if(targetDate===anchor)return next;
 if(event.type==="recruitment_start")next.recruitment={...next.recruitment,start:shiftPoint(next.recruitment.start,anchor,targetDate)};
 else if(event.type==="recruitment_deadline")next.recruitment={...next.recruitment,end:shiftPoint(next.recruitment.end,anchor,targetDate)};
 else if(event.type==="personal"&&event.personalId){const item=next.personalEvents.find(x=>x.id===event.personalId);if(!item)throw new Error("개인 일정을 찾지 못했습니다.");item.schedule=shiftRange(item.schedule,anchor,targetDate)}
 else if(event.stageId){const stage=next.stages.find(x=>x.id===event.stageId);if(!stage)throw new Error("전형을 찾지 못했습니다.");if(event.type==="result_expected")stage.resultExpectedAt=shiftPoint(stage.resultExpectedAt,anchor,targetDate);else if(event.type==="result_confirmed")stage.resultConfirmedAt=shiftPoint(stage.resultConfirmedAt,anchor,targetDate);else stage.schedule=shiftRange(stage.schedule,anchor,targetDate)}
 else throw new Error("이 일정을 변경할 수 없습니다.");
 if(next.origin!=="manual"&&(event.type==="recruitment_start"||event.type==="recruitment_deadline"))next.recruitmentOrigin="user_override";
 validateApplication(next);return next;
}
export function due(a:Application,now=Date.now()){const p=a.recruitment.end;if(!p)return{label:"마감일 미공개",closed:false,urgent:false};const days=Math.round((Date.parse(p.date)-Date.parse(kstDate(now)))/86400000);const closed=p.time!==null?pointMs(p)<=now:days<0;return{label:closed?"모집 마감":days===0?"D-day":days>0?"D-"+days:"D-day",closed,urgent:!closed&&(p.time!==null?pointMs(p)-now<=72*3600000:days<=3)}}
export function officialCompany(provider:string){return BANKS.find(b=>b.id===provider)}

