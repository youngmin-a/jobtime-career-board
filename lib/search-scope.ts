import type {Candidate} from './search-types';
export const SEARCH_PERIOD='2026-H2';
export type SearchBasis={period:'2026-H2';method:'official-cycle'|'title-cycle'|'recruitment-start';label:string};
export function classifyHalfYear(candidate:Pick<Candidate,'title'|'start'|'end'|'sourceKind'>):SearchBasis|null{
 const title=candidate.title.normalize('NFC');
 const explicit=/2026\s*(?:년|년도)?\s*하반기|하반기\s*2026|2026\s*[-/]?\s*H2\b/i.test(title);
 const start=candidate.start?.date;
 if(start&&candidate.end&&candidate.end.date<start)return null;
 // 접수 시작일이 확인되면 제목에 적힌 입사 연도·상반기 표현보다 시작일을 우선한다.
 if(start){
  if(start>='2026-07-01'&&start<'2027-01-01')return {period:SEARCH_PERIOD,method:'recruitment-start',label:'접수 시작일 기준 · '+start};
  return null;
 }
 // 시작일이 없는 회차는 검색 결과에서 확인 불가로 따로 노출하기 위한 근거만 제공한다.
 if(explicit)return {period:SEARCH_PERIOD,method:'title-cycle',label:'공고명 기준 · 접수 시작일 미확인'};
 return null;
}
export function verifiedCandidates(candidates:Candidate[]){return candidates.flatMap(c=>{const searchBasis=classifyHalfYear(c);return searchBasis&&!!c.start?[{...c,searchBasis}]:[]})}
export function uncertainCandidates(candidates:Candidate[]){return candidates.flatMap(c=>{const searchBasis=classifyHalfYear(c);return searchBasis&&!c.start?[{...c,searchBasis}]:[]})}
