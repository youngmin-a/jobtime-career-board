import {newApplication,point,type Application} from './applications';
import type {DatePoint} from './jobs';
export type Candidate={id:string;provider:string;companyName:string;title:string;role:string;employmentType:string;url:string;start:DatePoint|null;end:DatePoint|null;sourceName:string;sourceKind:'official'|'public';evidence:string;checkedAt:string};
export type Selection={provider:string;id:string;query:string};
export type SearchResult={candidates:Candidate[];warnings:string[];query:string;total:number};
export function candidateApplication(c:Candidate):Application{const a=newApplication(),recruitment={start:point(c.start),end:point(c.end),tentative:false};return{...a,companyName:c.companyName,postingTitle:c.title,role:c.role,employmentType:c.employmentType,postingUrl:c.url,origin:c.sourceKind,provider:c.provider,sourceName:c.sourceName,officialPostingId:c.id,recruitment,recruitmentOrigin:c.sourceKind,officialRecruitmentSnapshot:structuredClone(recruitment),evidence:c.evidence,officialCheckedAt:c.checkedAt}}
