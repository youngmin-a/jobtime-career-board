import type {Candidate} from './search-types';
export const SEARCH_PERIOD='2026-H2';
export type SearchBasis={period:'2026-H2';method:'official-cycle'|'title-cycle'|'recruitment-start';label:string};
export function classifyHalfYear(candidate:Pick<Candidate,'title'|'start'|'end'|'sourceKind'>):SearchBasis|null{
 const title=candidate.title.normalize('NFC');
 const years=[...title.matchAll(/20\d{2}/g)].map(m=>m[0]);
 if(years.some(y=>y!=='2026')||/상반기|상반년도|first\s+half|\bH1\b/i.test(title))return null;
 const explicit=/2026\s*(?:년|년도)?\s*하반기|하반기\s*2026|2026\s*[-/]?\s*H2\b/i.test(title);
 const start=candidate.start?.date;
 if(start&&candidate.end&&candidate.end.date<start)return null;
 if(explicit){if(start&&(start<'2026-07-01'||start>='2027-01-01'))return null;return {period:SEARCH_PERIOD,method:candidate.sourceKind==='official'?'official-cycle':'title-cycle',label:candidate.sourceKind==='official'?'공식 공고명: 2026년 하반기':'공고명: 2026년 하반기'}}
 if(start&&start>='2026-07-01'&&start<'2027-01-01')return {period:SEARCH_PERIOD,method:'recruitment-start',label:'접수 시작일 기준 · '+start};
 return null;
}
export function verifiedCandidates(candidates:Candidate[]){return candidates.flatMap(c=>{const searchBasis=classifyHalfYear(c);return searchBasis?[{...c,searchBasis}]:[]})}
