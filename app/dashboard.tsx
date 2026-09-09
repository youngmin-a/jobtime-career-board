"use client";

import {due, eventDate, eventLabels, managementLabels, type Application, type CalendarEvent} from "@/lib/applications";
import {formatPoint} from "@/lib/jobs";

type DashboardProps = {apps: Application[]; upcoming: CalendarEvent[]; now: number; onOpen: (application: Application) => void; onCalendar: () => void; onBoard: () => void};

export function Dashboard({apps, upcoming, now, onOpen, onCalendar, onBoard}: DashboardProps) {
  const urgent = apps.filter(application => due(application, now).urgent).sort((a, b) => (a.recruitment.end?.date ?? "9999").localeCompare(b.recruitment.end?.date ?? "9999"));
  const active = apps.filter(application => application.managementStatus === "active");
  const nextLabel = (event: CalendarEvent) => event.title === eventLabels[event.type] ? event.title : eventLabels[event.type] + " · " + event.title;
  return <div className="dashboard-page">
    <section className="stats-strip" aria-label="지원 현황 요약"><div><span>전체 공고</span><strong>{apps.length}</strong></div><div><span>지원 중</span><strong>{active.length}</strong></div><div><span>3일 이내 마감</span><strong>{urgent.length}</strong></div><div><span>최종합격</span><strong>{apps.filter(application => application.managementStatus === "accepted").length}</strong></div></section>
    <div className="dashboard-grid">
      <section className="dashboard-section"><div className="section-heading"><div><h2>지금 확인할 일정</h2><p>완료하지 않은 가까운 일정입니다.</p></div><button type="button" onClick={onCalendar}>캘린더 열기 ↗</button></div>{upcoming.length ? <div className="dashboard-list">{upcoming.slice(0, 6).map(event => <button type="button" key={event.id} onClick={() => onOpen(apps.find(application => application.id === event.applicationId)!)}><time>{eventDate(event).slice(5)}{(event.schedule.start ?? event.schedule.end)?.time && <small> {(event.schedule.start ?? event.schedule.end)?.time}</small>}</time><span><strong>{event.companyName}</strong><small>{nextLabel(event)}</small></span></button>)}</div> : <p className="empty compact-empty">예정된 일정이 없습니다.</p>}</section>
      <section className="dashboard-section"><div className="section-heading"><div><h2>마감이 가까운 공고</h2><p>모집 마감과 지원 전형은 따로 관리합니다.</p></div><button type="button" onClick={onBoard}>전형 보드 ↗</button></div>{urgent.length ? <div className="dashboard-list">{urgent.slice(0, 6).map(application => {const deadline = application.recruitment.end; return <button type="button" key={application.id} onClick={() => onOpen(application)}><span><strong>{application.companyName}</strong><small>{application.postingTitle} · {managementLabels[application.managementStatus]}</small></span><time>{deadline ? formatPoint(deadline) : "마감일 미공개"}</time></button>;})}</div> : <p className="empty compact-empty">급한 마감 공고가 없습니다.</p>}</section>
    </div>
    {!apps.length && <div className="empty welcome"><h2>첫 공고를 추가해보세요</h2><p>캘린더에서 마감과 전형 일정을 한곳에 관리할 수 있습니다.</p></div>}
  </div>;
}
