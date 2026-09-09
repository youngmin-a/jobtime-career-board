"use client";
import {useEffect,useRef,useState} from 'react';
import {formatPoint,kstDate,pointMs} from '@/lib/jobs';
import type {Application} from '@/lib/applications';
import {samePosting} from '@/lib/posting-identity';
import {candidateApplication,type Candidate,type SearchResult,type Selection} from '@/lib/search-types';
import {Modal} from './editor';
function closed(c:Candidate){return !!c.end&&(c.end.time?pointMs(c.end)<=Date.now():c.end.date<kstDate())}
export function SearchDialog({onClose,onManual,onSelect,applications,onExisting}:{onClose:()=>void;onManual:()=>void;onSelect:(candidate:Candidate,selection:Selection)=>Promise<void>;applications:Application[];onExisting:(a:Application)=>void}){
 const [query,setQuery]=useState(''),[busy,setBusy]=useState(false),[adding,setAdding]=useState<string|null>(null),[result,setResult]=useState<SearchResult|null>(null),[error,setError]=useState(''),[filter,setFilter]=useState('all');
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 async function search(page=1){if(busy)return;setBusy(true);setError('');if(page===1)setResult(null);try{
  const r=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:page===1?query:result?.query,page})}),s=JSON.parse(await r.text()) as SearchResult&{error?:string};if(!r.ok)throw new Error(s.error);if(!alive.current)return;
  if(page>1&&s.failed){setError(s.warnings.join(' '));return}
  setResult(before=>page===1||!before?s:{...s,candidates:[...before.candidates,...s.candidates.filter(c=>!before.candidates.some(x=>x.provider===c.provider&&x.id===c.id))],scanned:(before.scanned??0)+(s.scanned??0),warnings:[...new Set([...before.warnings,...s.warnings])]});
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:'검색에 실패했습니다.')}finally{if(alive.current)setBusy(false)}}
 async function add(c:Candidate){if(adding)return;setAdding(c.provider+':'+c.id);setError('');try{await onSelect(c,{provider:c.provider,id:c.id,query:result!.query,page:c.sourcePage??1})}catch(e){if(alive.current)setError(e instanceof Error?e.message:'공고를 저장하지 못했습니다.')}finally{if(alive.current)setAdding(null)}}
 const visible=result?.candidates.filter(c=>filter==='all'||(filter==='closed'?closed(c):!closed(c)))??[];
 return <Modal title="내 공고 추가" onClose={()=>{if(!adding)onClose()}}><div className="search-intro"><p><strong>2026년 하반기 · 마감 공고 포함</strong></p><button type="button" onClick={onManual}>직접 등록 ↗</button></div><form className="search-form" onSubmit={e=>{e.preventDefault();void search()}}><label className="sr-only" htmlFor="job-search">기업명 또는 공고 키워드</label><input id="job-search" autoFocus required maxLength={2000} disabled={busy||!!adding} value={query} onChange={e=>setQuery(e.target.value)} placeholder="기업명, 직무 또는 공식 공고 주소"/><button className="primary" disabled={busy||!!adding}>{busy?'검색 중…':'검색'}</button></form><p className="search-scope">제목의 채용 회차 또는 원래 접수 시작일로 확인합니다. 공식 KB·IBK·NH 목록, 우리은행 하반기 원문, 인크루트 공개 검색을 지원합니다. 내 공고에 추가해도 기업에 지원서가 제출되지는 않습니다.</p>
 {error&&<p className="error" role="alert">{error}</p>}
 {busy&&!result&&<div className="search-results" role="status">공식 원문과 모집 기간을 확인하고 있어요…</div>}
 {result&&<div className="search-results"><div className="section-heading"><h3>확인된 하반기 공고 <span>{result.candidates.length}</span></h3><select aria-label="모집 상태 필터" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">전체 · 마감 포함</option><option value="open">마감 전</option><option value="closed">마감</option></select></div>{result.warnings.map(w=><p className="notice" key={w}>{w}</p>)}
 {visible.map(c=>{const existing=applications.find(a=>samePosting(a,candidateApplication(c)));return <article className="search-result" key={c.provider+':'+c.id}><div className="result-top"><strong>{c.companyName}</strong><span className="badge">{closed(c)?'모집 마감':c.start&&c.start.date>kstDate()?'모집 예정':c.end?'마감 전':'마감일 미공개'}</span><span className={'source-badge '+c.sourceKind}>{c.sourceKind==='official'?'공식 채용':'공개 채용정보'}</span></div><h3>{c.title}</h3><p className="scope-evidence">{c.searchBasis?.label}</p><div className="result-period"><span><small>모집 시작</small>{formatPoint(c.start)}</span><span><small>모집 마감</small>{formatPoint(c.end)}</span></div><div className="result-bottom"><a href={c.url} target="_blank" rel="noreferrer">{c.sourceName} ↗</a>{existing?<button className="primary-soft" onClick={()=>onExisting(existing)}>추가됨 · 공고 열기</button>:<button className="primary-soft" disabled={!!adding} onClick={()=>void add(c)}>{adding===c.provider+':'+c.id?'저장 중…':'내 공고에 추가'}</button>}</div></article>})}
 {!visible.length&&<div className="empty"><h3>{result.failed?'검색 소스를 확인하지 못했습니다':result.candidates.length?'이 조건에 해당하는 공고가 없습니다':'확인한 범위에 하반기 공고가 없습니다'}</h3><p>{result.nextPage?'추가 후보를 불러오거나 검색어를 구체화해 보세요.':'다른 연도·반기로 범위를 넓히지 않습니다. 직접 등록은 계속 가능합니다.'}</p><button onClick={onManual}>직접 등록하기</button></div>}
 <p className="hint">후보 {result.scanned??0}개 확인{result.partial?' · 전체 공고를 모두 조회한 결과는 아닙니다.':''}</p>{result.nextPage&&<button disabled={busy||!!adding} onClick={()=>void search(result.nextPage!)}>{busy?'추가 조회 중…':'추가 후보 불러오기'}</button>}</div>}
 {!busy&&!result&&<div className="search-examples"><span>기업명으로 검색해보세요</span>{['우리은행','국민은행','기업은행','농협은행'].map(q=><button key={q} onClick={()=>setQuery(q)}>{q}</button>)}</div>}
 </Modal>
}
