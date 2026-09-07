"use client";
import {useState} from 'react';
import {formatPoint} from '@/lib/jobs';
import type {Candidate,SearchResult,Selection} from '@/lib/search-types';
import {Modal} from './editor';
export function SearchDialog({onClose,onManual,onSelect}:{onClose:()=>void;onManual:()=>void;onSelect:(candidate:Candidate,selection:Selection)=>void}){
 const [query,setQuery]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<SearchResult|null>(null),[error,setError]=useState('');
 async function search(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setResult(null);try{const r=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})}),s=JSON.parse(await r.text());if(!r.ok)throw new Error(s.error);setResult(s)}catch(e){setError(e instanceof Error?e.message:'검색에 실패했습니다.')}finally{setBusy(false)}}
 return <Modal title="어떤 기회를 준비하고 있나요?" onClose={onClose}><div className="search-intro"><p>기업명부터 직무까지, 실제 채용공고를 찾아보세요.</p><button type="button" onClick={onManual}>직접 등록 ↗</button></div><form className="search-form" onSubmit={search}><label className="sr-only" htmlFor="job-search">기업명 또는 공고 키워드</label><input id="job-search" autoFocus required maxLength={2000} disabled={busy} value={query} onChange={e=>setQuery(e.target.value)} placeholder="기업명, 직무 또는 공고 키워드"/><button className="primary" disabled={busy}>{busy?'검색 중…':'검색'}</button></form><p className="search-scope">인크루트 공개 검색 + KB·IBK·NH 공식 채용 · 공개 검색은 최대 20개 후보를 가져옵니다. 모든 기업·공고를 포함하지 않으며, 관련 기업이나 채용대행 공고가 섞일 수 있습니다.</p>
 {error&&<p className="error" role="alert">{error}</p>}
 {busy&&<div className="search-results" aria-label="공고 검색 중">{[1,2,3].map(i=><div className="skeleton search-skeleton" key={i}/>)}</div>}
 {result&&<div className="search-results"><div className="section-heading"><h3>확인된 공고 <span>{result.candidates.length}</span></h3><small>선택한 공고만 등록됩니다</small></div>{result.warnings.map(w=><p className="notice" key={w}>{w}</p>)}
 {result.candidates.map(c=><article className="search-result" key={c.provider+':'+c.id}><div className="result-top"><strong>{c.companyName}</strong><span className={'source-badge '+c.sourceKind}>{c.sourceKind==='official'?'공식 채용':'공개 채용정보'}</span></div><h3>{c.title}</h3>{c.role&&<p className="hint">{c.role}</p>}<div className="result-period"><span><small>모집 시작</small>{formatPoint(c.start)}</span><span><small>모집 마감</small>{formatPoint(c.end)}</span></div><div className="result-bottom"><a href={c.url} target="_blank" rel="noreferrer">{c.sourceName} ↗</a><button className="primary-soft" onClick={()=>onSelect(c,{provider:c.provider,id:c.id,query:result.query})}>선택·내용 확인 →</button></div></article>)}
 {!result.candidates.length&&<div className="empty"><h3>검색된 공고가 없습니다</h3><p>원하는 공고를 직접 등록해 준비를 이어가세요.</p><button className="primary" onClick={onManual}>직접 등록하기</button></div>}</div>}
 {!busy&&!result&&<div className="search-examples"><span>이렇게 검색해보세요</span>{['우리은행','현대자동차','청년인턴','기업금융'].map(q=><button key={q} onClick={()=>setQuery(q)}>{q}</button>)}</div>}
 </Modal>
}

