"use client";

import {useEffect, useRef, useState} from "react";
import {formatPoint, kstDate, pointMs, type DatePoint} from "@/lib/jobs";
import {newApplication, point, type Application} from "@/lib/applications";
import {samePosting} from "@/lib/posting-identity";
import {candidateApplication, type Candidate, type SearchResult, type Selection, type WebCandidate} from "@/lib/search-types";
import {Modal} from "./editor";

function closed(candidate: Candidate) {
  return !!candidate.end && (candidate.end.time ? pointMs(candidate.end) <= Date.now() : candidate.end.date < kstDate());
}

type SearchProps = {
  onClose: () => void;
  onManual: (seed?: {postingUrl?: string; companyName?: string; postingTitle?: string; start?: DatePoint | null; end?: DatePoint | null}) => void;
  onSelect: (candidate: Candidate, selection: Selection) => Promise<void>;
  applications: Application[];
  onExisting: (application: Application) => void;
  sessionTag: string;
};
type SearchContentProps = Omit<SearchProps, "onClose">;

export function SearchContent({onManual, onSelect, applications, onExisting, sessionTag}: SearchContentProps) {
  const storageKey = "취준캘린더:search:" + sessionTag;
  const restored = useRef(false);
  const alive = useRef(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [enriched, setEnriched] = useState<Record<string, Candidate>>({});
  const [showWebCount, setShowWebCount] = useState(8);

  useEffect(() => {
    alive.current = true;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {query?: string; result?: SearchResult; filter?: string};
        if (typeof parsed.query === "string") setQuery(parsed.query);
        if (parsed.result) setResult(parsed.result);
        if (typeof parsed.filter === "string") setFilter(parsed.filter);
      }
    } catch { /* ignore stale session data */ }
    restored.current = true;
    return () => { alive.current = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!restored.current) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({query, result, filter})); } catch { /* storage is optional */ }
  }, [storageKey, query, result, filter]);

  async function search(page = 1) {
    if (busy || !query.trim()) return;
    setBusy(true); setError(""); setEnriched({}); setShowWebCount(8);
    if (page === 1) setResult(null);
    try {
      const response = await fetch("/api/search", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({query: page === 1 ? query : result?.query, page})});
      const payload = JSON.parse(await response.text()) as SearchResult & {error?: string};
      if (!response.ok) throw new Error(payload.error);
      if (!alive.current) return;
      if (page > 1 && payload.failed) { setError(payload.warnings.join(" ")); return; }
      setResult(previous => page === 1 || !previous ? payload : {
        ...payload,
        candidates: [...previous.candidates, ...payload.candidates.filter(c => !previous.candidates.some(x => x.provider === c.provider && x.id === c.id))],
        uncertainCandidates: [...(previous.uncertainCandidates ?? []), ...(payload.uncertainCandidates ?? []).filter(c => !(previous.uncertainCandidates ?? []).some(x => x.provider === c.provider && x.id === c.id))],
        webCandidates: [...(previous.webCandidates ?? []), ...(payload.webCandidates ?? [])],
        scanned: (previous.scanned ?? 0) + (payload.scanned ?? 0),
        warnings: [...new Set([...previous.warnings, ...payload.warnings])],
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "검색에 실패했습니다."); }
    finally { if (alive.current) setBusy(false); }
  }

  async function add(candidate: Candidate, selection?: Selection) {
    if (adding) return;
    setAdding(candidate.provider + ":" + candidate.id); setError("");
    try { await onSelect(candidate, selection ?? {provider: candidate.provider, id: candidate.id, query: result?.query ?? query, page: candidate.sourcePage ?? 1}); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "공고를 저장하지 못했습니다."); }
    finally { if (alive.current) setAdding(null); }
  }

  async function enrich(candidate: WebCandidate) {
    if (enriching || enriched[candidate.id]) return;
    setEnriching(candidate.id); setError("");
    try {
      const response = await fetch("/api/search", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "enrich", url: candidate.url, companyName: candidate.companyName ?? ""})});
      const payload = JSON.parse(await response.text()) as Candidate & {error?: string};
      if (!response.ok) throw new Error(payload.error);
      if (alive.current) setEnriched(previous => ({...previous, [candidate.id]: payload}));
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "원문을 읽지 못했습니다. URL을 보존해 직접 등록할 수 있습니다."); }
    finally { if (alive.current) setEnriching(null); }
  }

  const visible = result?.candidates.filter(candidate => filter === "all" || (filter === "closed" ? closed(candidate) : !closed(candidate))) ?? [];
  const openWeb = () => { window.open("https://www.google.com/search?q=" + encodeURIComponent(result?.query ?? query), "_blank", "noopener,noreferrer"); };

  return <div className="search-panel">
    <div className="search-intro"><p><strong>공식 채용처와 공개 채용정보를 함께 확인합니다.</strong></p><button type="button" onClick={() => onManual()}>직접 등록 ↗</button></div>
    <form className="search-form" onSubmit={event => {event.preventDefault(); void search();}}>
      <label className="sr-only" htmlFor="job-search">기업명 또는 공고 키워드</label>
      <input id="job-search" autoFocus={!result} required maxLength={2000} disabled={busy || !!adding || !!enriching} value={query} onChange={event => setQuery(event.target.value)} placeholder="기업명, 직무 또는 공식 공고 주소" />
      <button className="primary" disabled={busy || !!adding || !!enriching}>{busy ? "검색 중…" : "검색"}</button>
    </form>
    <p className="search-scope">실제 모집 접수 시작일을 우선 확인하며, 시작일·마감일을 확인하지 못한 후보는 임의로 채우지 않습니다.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {busy && !result && <div className="search-results" role="status">공식 원문과 모집 기간을 확인하고 있어요…</div>}
    {result && <div className="search-results">
      <div className="section-heading"><h3>확인된 공고 <span>{result.candidates.length}</span></h3><select aria-label="모집 상태 필터" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">전체 · 마감 포함</option><option value="open">마감 전</option><option value="closed">마감</option></select></div>
      {result.warnings.map(warning => <p className="notice" key={warning}>{warning}</p>)}
      {visible.map(candidate => {
        const existing = applications.find(application => samePosting(application, candidateApplication(candidate)));
        return <article className="search-result" key={candidate.provider + ":" + candidate.id}>
          <div className="result-top"><strong>{candidate.companyName}</strong><span className="badge">{closed(candidate) ? "모집 마감" : candidate.start && candidate.start.date > kstDate() ? "모집 예정" : candidate.end ? "마감 전" : "마감일 미공개"}</span><span className={'source-badge ' + candidate.sourceKind}>{candidate.sourceKind === "official" ? "공식 채용" : "공개 채용정보"}</span></div>
          <h3>{candidate.title}</h3><p className="scope-evidence">{candidate.searchBasis?.label}</p>
          <div className="result-period"><span><small>모집 시작</small>{formatPoint(candidate.start)}</span><span><small>모집 마감</small>{formatPoint(candidate.end)}</span></div>
          <div className="result-bottom"><a href={candidate.url} target="_blank" rel="noreferrer">{candidate.sourceName} ↗</a>{existing ? <button className="primary-soft" onClick={() => onExisting(existing)}>추가됨 · 공고 열기</button> : <button className="primary-soft" disabled={!!adding} onClick={() => void add(candidate)}>{adding === candidate.provider + ":" + candidate.id ? "저장 중…" : "내 공고에 추가"}</button>}</div>
        </article>;
      })}
      {!visible.length && <div className="empty"><h3>{result.failed ? "검색 소스를 확인하지 못했습니다" : result.candidates.length ? "이 조건에 해당하는 공고가 없습니다" : "확인한 범위에 공고가 없습니다"}</h3><p>{result.nextPage ? "추가 후보를 불러오거나 검색어를 구체화해 보세요." : "직접 등록은 계속 가능합니다."}</p><button onClick={() => onManual()}>직접 등록하기</button></div>}
      {result.uncertainCandidates?.length ? <section className="search-uncertain"><h3>모집 시기 미확인 <span>{result.uncertainCandidates.length}</span></h3><p className="hint">접수 시작일을 원문에서 확인하지 못한 후보입니다. 날짜를 추정하지 않고 원문과 함께 보관합니다.</p>{result.uncertainCandidates.map(candidate => <article className="search-result uncertain" key={'uncertain:' + candidate.provider + ':' + candidate.id}><div className="result-top"><strong>{candidate.companyName}</strong><span className="badge">시기 미확인</span></div><h3>{candidate.title}</h3><div className="result-bottom"><a href={candidate.url} target="_blank" rel="noreferrer">원문 열기 ↗</a><button className="primary-soft" onClick={() => onManual({postingUrl: candidate.url, companyName: candidate.companyName, postingTitle: candidate.title})}>URL로 직접 등록</button></div></article>)}</section> : null}
      {result.webCandidates?.length ? <section className="search-uncertain"><h3>웹에서 찾은 관련 공고 <span>{result.webCandidates.length}</span></h3><p className="hint">네이버·Tavily 등에서 발견한 후보입니다. 원문에서 확인된 값만 미리 채웁니다.</p>{result.webCandidates.slice(0, showWebCount).map(candidate => {const preview = enriched[candidate.id]; return <article className={'search-result uncertain ' + (preview ? 'web-preview' : '')} key={'web:' + candidate.id}><div className="result-top"><strong>{preview?.companyName ?? candidate.companyName ?? "기업명 자동 확인 전"}</strong><span className="source-badge public">{preview?.sourceName ?? candidate.sourceName}</span></div><h3>{preview?.title ?? candidate.title}</h3>{preview ? <><div className="result-period"><span><small>모집 시작</small>{formatPoint(preview.start)}</span><span><small>모집 마감</small>{formatPoint(preview.end)}</span></div><p className="scope-evidence">{preview.evidence}</p><p className="hint">직무 {preview.role || "자동 확인 불가"} · 채용 구분 {preview.employmentType || "자동 확인 불가"}</p></> : <p className="hint">{candidate.description || "원문에서 공고 정보와 모집기간을 확인할 수 있습니다."}</p>}<div className="result-bottom"><a href={candidate.url} target="_blank" rel="noreferrer">원문 열기 ↗</a>{preview ? <button className="primary-soft" disabled={!!adding} onClick={() => void add(preview, {provider: "web-source", id: preview.id, query: candidate.url, page: 1, companyName: preview.companyName})}>{adding === "web-source:" + preview.id ? "저장 중…" : "내 공고에 추가"}</button> : <><button className="primary-soft" disabled={!!enriching || !!adding} onClick={() => void enrich(candidate)}>{enriching === candidate.id ? "모집기간 확인 중…" : "공고 정보 가져오기"}</button><button type="button" onClick={() => onManual({postingUrl: candidate.url, companyName: candidate.companyName, postingTitle: candidate.title, start: candidate.start ?? null, end: candidate.end ?? null})}>URL로 최소 등록</button></>}</div></article>;})}{result.webCandidates.length > showWebCount && <button type="button" onClick={() => setShowWebCount(count => Math.min(count + 8, result.webCandidates?.length ?? count))}>관련 후보 더 보기 ({result.webCandidates.length - showWebCount}개)</button>}</section> : null}
      <div className="search-more-actions"><button type="button" onClick={openWeb}>웹에서 더 찾기 ↗</button>{result.manualUrl && <button type="button" className="primary-soft" onClick={() => onManual({postingUrl: result.manualUrl})}>이 URL로 직접 등록</button>}</div>
      <p className="hint">확인된 공고 {result.candidates.length}개 · 추가 후보 {result.webCandidates?.length ?? 0}개 · {result.scanned ?? 0}개 스캔{result.partial ? " · 전체 공고를 모두 조회한 결과는 아닙니다." : ""}</p>
      {result.nextPage && <button disabled={busy || !!adding} onClick={() => void search(result.nextPage!)}>{busy ? "추가 조회 중…" : "추가 후보 불러오기"}</button>}
    </div>}
    {!busy && !result && <div className="search-examples"><span>기업명으로 검색해보세요</span>{["우리은행", "국민은행", "기업은행", "농협은행", "신한은행", "산업은행", "iM뱅크", "금융감독원"].map(example => <button key={example} onClick={() => setQuery(example)}>{example}</button>)}</div>}
  </div>;
}

export function SearchDialog(props: SearchProps) {
  return <Modal title="공고 검색" onClose={props.onClose}><SearchContent onManual={props.onManual} onSelect={props.onSelect} applications={props.applications} onExisting={props.onExisting} sessionTag={props.sessionTag} /></Modal>;
}

type QuickDraft = {companyName: string; postingTitle: string; postingUrl: string; startDate: string; startTime: string; endDate: string; endTime: string; showDeadline: boolean; showUrl: boolean; showStage: boolean; currentStageName: string};
type AddDialogProps = {onClose: () => void; onSave: (application: Application, selection?: Selection) => Promise<void>; onSearchSelect: (candidate: Candidate, selection: Selection) => Promise<void>; applications: Application[]; onExisting: (application: Application) => void; sessionTag: string};

function toPoint(date: string, time: string): DatePoint | null { return date ? {date, time: time || null} : null; }

export function AddDialog({onClose, onSave, onSearchSelect, applications, onExisting, sessionTag}: AddDialogProps) {
  const [mode, setMode] = useState<"quick" | "link" | "search">("quick");
  const [draft, setDraft] = useState<QuickDraft>({companyName: "", postingTitle: "", postingUrl: "", startDate: "", startTime: "", endDate: "", endTime: "", showDeadline: false, showUrl: false, showStage: false, currentStageName: ""});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (patch: Partial<QuickDraft>) => setDraft(previous => ({...previous, ...patch}));
  const selectSuggestion = (companyName: string) => update({companyName});
  const buildApplication = () => {
    const application = newApplication();
    application.companyName = draft.companyName.trim(); application.postingTitle = draft.postingTitle.trim();
    application.postingUrl = draft.postingUrl.trim() || null;
    application.recruitment = {start: point(toPoint(draft.startDate, draft.startTime)), end: point(toPoint(draft.endDate, draft.endTime)), tentative: false};
    if (draft.currentStageName) { const stage = application.stages.find(item => item.name === draft.currentStageName); if (stage) application.currentStageId = stage.id; application.managementStatus = "preparing"; }
    return application;
  };
  async function saveQuick(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.companyName.trim() || !draft.postingTitle.trim()) { setError("기업명과 공고명을 입력해주세요."); return; }
    setBusy(true); setError("");
    try { await onSave(buildApplication()); } catch (e) { setError(e instanceof Error ? e.message : "공고를 저장하지 못했습니다."); } finally { setBusy(false); }
  }
  async function importLink(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.postingUrl.trim()) { setError("공고 URL을 입력해주세요."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/search", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({query: draft.postingUrl.trim()})});
      const payload = JSON.parse(await response.text()) as SearchResult & {error?: string};
      if (!response.ok) throw new Error(payload.error);
      const candidate = payload.candidates[0] ?? payload.uncertainCandidates?.[0];
      if (!candidate) throw new Error("공고 정보를 확인하지 못했습니다. 회사명·공고명을 입력해 직접 저장할 수 있습니다.");
      const selection: Selection = {provider: candidate.provider, id: candidate.id, query: draft.postingUrl.trim(), page: candidate.sourcePage ?? 1, companyName: candidate.companyName};
      const application = buildApplication();
      if (!application.companyName) application.companyName = candidate.companyName;
      if (!application.postingTitle) application.postingTitle = candidate.title;
      if (!application.role) application.role = candidate.role;
      if (!application.postingUrl) application.postingUrl = candidate.url;
      if (!application.recruitment.start) application.recruitment.start = point(candidate.start);
      if (!application.recruitment.end) application.recruitment.end = point(candidate.end);
      await onSave(application, selection);
    } catch (e) { setError(e instanceof Error ? e.message : "URL 확인에 실패했습니다. 입력한 URL은 유지됩니다."); }
    finally { setBusy(false); }
  }
  const setSearchManual = (seed?: {postingUrl?: string; companyName?: string; postingTitle?: string; start?: DatePoint | null; end?: DatePoint | null}) => { update({postingUrl: seed?.postingUrl ?? draft.postingUrl, companyName: seed?.companyName ?? draft.companyName, postingTitle: seed?.postingTitle ?? draft.postingTitle, startDate: seed?.start?.date ?? draft.startDate, startTime: seed?.start?.time ?? draft.startTime, endDate: seed?.end?.date ?? draft.endDate, endTime: seed?.end?.time ?? draft.endTime, showUrl: !!(seed?.postingUrl || draft.showUrl), showDeadline: !!(seed?.start || seed?.end || draft.showDeadline)}); setMode("quick"); };

  return <Modal title="공고 추가" onClose={() => {if (!busy) onClose();}} className="add-dialog">
    <div className="add-intro"><strong>공고를 저장하고 필요한 일정만 관리하세요.</strong><span>회사명과 공고명만 입력해도 바로 시작할 수 있습니다.</span></div>
    <div className="add-tabs" role="tablist" aria-label="공고 추가 방법"><button type="button" role="tab" aria-selected={mode === "quick"} className={mode === "quick" ? "active" : ""} onClick={() => setMode("quick")}>빠르게 추가</button><button type="button" role="tab" aria-selected={mode === "link"} className={mode === "link" ? "active" : ""} onClick={() => setMode("link")}>링크로 추가</button><button type="button" role="tab" aria-selected={mode === "search"} className={mode === "search" ? "active" : ""} onClick={() => setMode("search")}>검색해서 추가</button></div>
    {mode === "search" ? <SearchContent onManual={setSearchManual} onSelect={onSearchSelect} applications={applications} onExisting={onExisting} sessionTag={sessionTag} /> : <form className="quick-form" onSubmit={mode === "quick" ? saveQuick : importLink}>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick-fields"><label>기업명 <input required={mode === "quick"} autoFocus value={draft.companyName} onChange={event => update({companyName: event.target.value})} placeholder="예: 신한은행" /></label><div className="quick-suggestions">{[...new Set(applications.map(application => application.companyName).filter(Boolean))].slice(0, 5).map(company => <button type="button" key={company} onClick={() => selectSuggestion(company)}>{company}</button>)}</div><label>공고명 <input required={mode === "quick"} value={draft.postingTitle} onChange={event => update({postingTitle: event.target.value})} placeholder="예: 2026년 하반기 신입행원" /></label></div>
      {mode === "link" && <label className="quick-option"><span>공고 URL</span><input type="url" required value={draft.postingUrl} onChange={event => update({postingUrl: event.target.value})} placeholder="https://" /><small>공고 원문에서 확인되는 기업명·공고명·일정만 채웁니다.</small></label>}
      {mode === "quick" && <div className="quick-chips"><button type="button" className={draft.showDeadline ? "selected" : ""} onClick={() => update({showDeadline: !draft.showDeadline})}>＋ 마감일</button><button type="button" className={draft.showUrl ? "selected" : ""} onClick={() => update({showUrl: !draft.showUrl})}>＋ 공고 링크</button><button type="button" className={draft.showStage ? "selected" : ""} onClick={() => update({showStage: !draft.showStage})}>＋ 현재 전형</button></div>}
      {mode === "quick" && draft.showDeadline && <div className="quick-option"><div className="quick-option-heading"><strong>모집 일정 <small>선택</small></strong></div><div className="quick-date-grid"><label>모집 시작일<input type="date" value={draft.startDate} onChange={event => update({startDate: event.target.value})} /><input type="time" aria-label="모집 시작 시각" value={draft.startTime} onChange={event => update({startTime: event.target.value})} /></label><label>모집 마감일<input type="date" value={draft.endDate} onChange={event => update({endDate: event.target.value})} /><input type="time" aria-label="모집 마감 시각" value={draft.endTime} onChange={event => update({endTime: event.target.value})} /></label></div><small>시각을 모르면 비워두세요. 날짜도 입력하지 않으면 일정은 생성되지 않습니다.</small></div>}
      {mode === "quick" && draft.showUrl && <label className="quick-option"><span>공고 URL <small>선택</small></span><input type="url" value={draft.postingUrl} onChange={event => update({postingUrl: event.target.value})} placeholder="https://" /></label>}
      {mode === "quick" && draft.showStage && <label className="quick-option"><span>현재 전형 <small>선택</small></span><select value={draft.currentStageName} onChange={event => update({currentStageName: event.target.value})}><option value="">아직 선택하지 않음</option>{newApplication().stages.map(stage => <option key={stage.name} value={stage.name}>{stage.name}</option>)}</select></label>}
      <div className="quick-actions"><button type="button" onClick={onClose}>취소</button><button className="primary" disabled={busy}>{busy ? mode === "link" ? "확인 중…" : "저장 중…" : mode === "link" ? "확인하고 추가" : "공고 저장"}</button></div>
    </form>}
  </Modal>;
}
