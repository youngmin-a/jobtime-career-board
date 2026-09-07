export type Provider = "kb" | "ibk" | "nh";
export type DatePoint = { date: string; time: string | null; second?: number };
export type Company = { id: string; name: string; provider: Provider | null };
export type Posting = {
  id: string; companyId: string; title: string; url: string;
  start: DatePoint | null; end: DatePoint | null;
  source: string; evidence: string; checkedAt: string;
  kind: "official" | "manual"; saved: boolean;
  stage: "관심" | "지원 준비" | "지원 완료"; notes: string;
};
export type Scan = { companyId: string; checkedAt: string; count: number; error?: string; warning?: string };
export type Store = { version: 1; companies: Company[]; postings: Posting[]; scans: Scan[] };
export const BANKS: { id: Provider; name: string; aliases: string[]; url: string; scope: string }[] = [
  { id: "kb", name: "KB국민은행", aliases: ["국민은행", "kb국민은행", "kb", "kookmin"], url: "https://kbstar.careerlink.kr/jobs", scope: "공식 신입 채용 사이트" },
  { id: "ibk", name: "IBK기업은행", aliases: ["기업은행", "ibk기업은행", "ibk"], url: "https://ibk.incruit.com/", scope: "공식 신입·수시 채용 사이트" },
  { id: "nh", name: "NH농협은행", aliases: ["농협은행", "nh농협은행", "농협", "nh"], url: "https://nhbank.incruit.com/", scope: "공식 신규직원 채용 사이트" },
];
export function resolveBank(name: string) {
  const normalized = name.toLowerCase().replace(/\s/g, "");
  return BANKS.find(b => b.aliases.includes(normalized));
}
export function kstDate(now = Date.now()) { return new Date(now + 9 * 3600000).toISOString().slice(0, 10); }
export function validDate(date: string) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function validPoint(p: DatePoint | null) {
  return p === null || (validDate(p.date) && (p.time === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) && (p.second === undefined || Number.isInteger(p.second) && p.second >= 0 && p.second <= 59));
}
export function pointMs(p: DatePoint) { return Date.parse(`${p.date}T${p.time ?? "00:00"}:${String(p.second ?? 0).padStart(2,"0")}+09:00`); }
export function formatPoint(p: DatePoint | null) {
  return p ? `${p.date.replaceAll("-", ".")}  ${p.time ?? "시간 미공개"}` : "일정 미공개";
}
export function deadline(post: Pick<Posting,"start"|"end">, now = Date.now()) {
  const today = kstDate(now);
  if (post.end && (post.end.time ? pointMs(post.end) <= now : post.end.date < today)) return { label:"마감", tone:"muted", closed:true, urgent:false };
  if (post.start && (post.start.time ? pointMs(post.start) > now : post.start.date > today)) return { label:"접수 예정", tone:"blue", closed:false, urgent:false };
  if (!post.end) return { label:"마감일 확인", tone:"muted", closed:false, urgent:false };
  if (!post.end.time) return { label: post.end.date === today ? "오늘 · 시간 확인" : `D-${Math.round((Date.parse(post.end.date)-Date.parse(today))/86400000)} · 시간 확인`, tone:"amber", closed:false, urgent:false };
  const minutes = Math.ceil((pointMs(post.end) - now) / 60000);
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60);
  return { label: days ? `${days}일 ${hours}시간 남음` : hours ? `${hours}시간 ${minutes % 60}분 남음` : `${minutes}분 남음`, tone:minutes <= 4320 ? "amber":"green", closed:false, urgent:minutes <= 4320 };
}

// 접수기간 구간만 전달받는다. 시험일·게시일을 모집일로 재사용하지 않는다.
export function parsePeriod(raw: string): { start: DatePoint; end: DatePoint; evidence: string } | null {
  const text = raw.replace(/[‘’']/g, "").replace(/\s+/g," ").trim();
  const parts = text.split(/[~∼～]/);
  if (parts.length < 2) return null;
  const full = /(20\d{2}|\d{2})\s*[.년/-]\s*(\d{1,2})\s*[.월/-]\s*(\d{1,2})/;
  const short = /(\d{1,2})\s*[.월/-]\s*(\d{1,2})/;
  const first = parts[0].match(full);
  if (!first) return null;
  const year = first[1].length === 2 ? `20${first[1]}` : first[1];
  const tail = parts[1];
  const endFull = tail.match(full), endShort = tail.match(short);
  if (!endFull && !endShort) return null;
  function time(s: string) {
    const m = s.match(/(?:오전\s*|오후\s*)?(\d{1,2})\s*[:시]\s*(\d{2})?\s*분?/);
    if (!m) return null;
    let hour = Number(m[1]);
    if (m[0].includes("오후") && hour < 12) hour += 12;
    if (m[0].includes("오전") && hour === 12) hour = 0;
    return `${String(hour).padStart(2,"0")}:${m[2] ?? "00"}`;
  }
  const start: DatePoint = {date:`${year}-${first[2].padStart(2,"0")}-${first[3].padStart(2,"0")}`,time:time(parts[0].slice((first.index ?? 0)+first[0].length))};
  const endYear = endFull ? endFull[1].length === 2 ? `20${endFull[1]}` : endFull[1] : year;
  const month = endFull ? endFull[2] : endShort![1], day = endFull ? endFull[3] : endShort![2];
  const match = endFull ?? endShort!;
  const end: DatePoint = {date:`${endYear}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`,time:time(tail.slice((match.index ?? 0)+match[0].length))};
  if (!validPoint(start) || !validPoint(end) || start.date > end.date) return null;
  return {start,end,evidence:raw.replace(/\s+/g," ").trim().slice(0,240)};
}
