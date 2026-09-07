# DESIGN — JOBTIME v2 실제 구현

기준: PRD.md · 2026-09-08 · KST

## 1. 구조
- app/page.tsx: 대시보드·내 공고 탭, 공통 서버 상태, 공식 검색/선택 모달.
- app/editor.tsx: 공고·전형·개인 일정 편집, 날짜 입력, 삭제 확인.
- app/calendar.tsx: 월간·주간·월별 목록, 기업·유형 필터, 날짜 목록.
- lib/applications.ts: v2 타입, 검증, v1 변환, D-day, 캘린더 파생.
- lib/jobs.ts: 기존 공식 타입·기간 분석·KST 유틸리티.
- lib/providers.ts: 기존 KB/IBK/NH 공식 조회 어댑터 유지.
- lib/repository.ts: D1 백업·이전·revision 원자 갱신.
- lib/store.ts: Cloudflare Workers env.DB 연결.
- db/schema.ts / drizzle: D1 스키마와 추가형 SQL 마이그레이션.

## 2. 화면과 인터랙션
실제 경로 / 안에서 대시보드·취업 캘린더·내 공고를 탭으로 전환한다. 동일 native dialog 편집기를 공유한다. 별도 /applications 또는 /calendar 라우트는 만들지 않았다.
헤더는 작은 화면에서 두 줄이다. 상세 편집은 기본 정보 2열에서 모바일 1열로 전환한다. 전형은 접이식 상세이며 현재 상태와 이름을 요약한다.
모달은 native dialog의 포커스 제한과 Escape 처리를 사용하고 닫을 때 기존 포커스로 복귀한다. 미저장 변경이 있으면 닫기 확인을 한다. 저장 요청 중 폼을 잠그고 실패하면 draft를 보존한다.
브랜드는 크림 바탕, 녹색, 라임 강조, 둥근 카드, 시스템 한글 글꼴을 사용한다. 달력 이벤트는 유형 색상과 텍스트 라벨을 함께 제공한다.

## 3. v2 모델
정확한 TypeScript 정의는 lib/applications.ts가 기준이다.
- State: version=2, revision, applications[]
- Application: UUID id, companyName, postingTitle, role/ employmentType/notes(빈 문자열 허용), postingUrl|null, origin, provider|null, officialPostingId|null, recruitment, recruitmentOrigin, officialRecruitmentSnapshot|null, evidence|null, officialCheckedAt|null, managementStatus, currentStageId|null, stages[], personalEvents[], createdAt, updatedAt
- Stage: id, name, order, status, applicable, schedule, resultExpectedAt|null, resultConfirmedAt|null, notes
- PersonalEvent: id, title, schedule, notes. 부모 공고 안에 보관하므로 별도 applicationId 중복 저장 없음.
- Point: date, time|null, timezone=Asia/Seoul, optional second
- Range: start|null, end|null, tentative

공고별 최대 40개 전형·100개 개인 일정, 전체 최대 500개 공고를 검증한다. 공고 필수 필드와 메모 길이·HTTPS URL·날짜·상태 enum·전형 순서·참조 ID를 서버에서 검증한다.
currentStageId는 적용 가능한 같은 공고 전형 또는 null이다. 전형 순서는 0부터 연속이다. 해당 없음은 applicable=false다.

## 4. 날짜와 파생 이벤트
캘린더 이벤트의 applicationId와 stageId/personalId는 원본 편집 대상으로 연결된다. 별도 이벤트 테이블은 없다.
모집 시작, 기간, 마감은 recruitment에서 파생한다. 전형명에 면접이 있으면 interview, 필기/검사/시험이면 exam, 나머지는 stage로 분류한다. 결과 예정과 확인, 개인 일정은 각 필드에서 파생한다.
날짜가 없으면 이벤트를 만들지 않는다. 기간은 종료일까지 포함하여 각 날짜에 표시한다. 월간 42셀, 주간 7일, 목록은 해당 월과 겹치는 일정이다.
시간이 없는 일정은 시간 미공개로 표시한다. 정확한 시간이 있는 일정은 KST 시점으로 비교한다. 오늘 이미 끝난 시각은 다음 일정에서 제외한다. 모집 마감은 관리 상태를 변경하지 않는다.

## 5. API와 저장
- GET /api/state: 현재 v2 상태, Cache-Control:no-store
- POST /api/search: query(기업명 또는 공식 URL), 공식 후보와 해석 경고
- POST /api/state: action과 revision을 받는 원자 변경
  - save: application 전체와 allowDuplicate
  - add-selected: provider, postingId, allowDuplicate; 서버 공식 재확인
  - delete: id
  - restore-backup: backupId, confirm=RESTORE; 운영 복구용
- GET /api/export: v2 JSON 다운로드

변경 요청은 같은 출처·JSON Content-Type·본문 500,000자 한도·revision을 검사한다. 수동 URL은 서버가 방문하지 않는다. 기존 공식 출처 필드는 서버가 원본에서 보존한다.
클라이언트는 편집 초안을 유지하다 저장 성공 응답으로 공통 state를 교체하고 모든 파생 화면을 계산한다. 실패 시 초안과 서버 원본이 유지된다. 409 충돌은 최신 상태를 다시 읽고 사용자가 덮어쓰기 여부를 결정하도록 안내한다.

## 6. D1와 이전
운영 단일 저장소는 env.DB이다. app_state는 이전 원본, job_state_v2는 현재 상태, job_backups는 보관 스냅샷이다. payload의 JSON은 D1 안의 직렬화 형식이며 파일 저장소가 아니다.
드리즐 0000은 그대로 두고 0001에서 v2와 backup 테이블만 추가한다. 최초 read에서만 v1을 변환한다. 백업과 v2 INSERT OR IGNORE를 D1 batch 트랜잭션으로 처리하여 재시도 가능하다.
일반 write는 revision 일치 조건의 백업 INSERT와 UPDATE를 batch로 실행한다. 다른 요청이 선점하면 변경 행 수 0 → 409다. 손상 데이터는 오류로 중단한다.
복구도 기존 상태를 백업한 뒤 같은 revision 갱신을 사용한다. 상세 운영 절차는 MIGRATION.md를 따른다.

## 7. 검증
tests/domain.test.ts는 날짜·상태·이전·캘린더와 실제 SQLite 트랜잭션 실패를 검증한다. scripts/integration.mjs는 실행 중 API의 CRUD·충돌·실패·공식 검색·프로세스 재시작을 확인한다.
화면 QA는 PC와 모바일 폭에서 월간/주간/목록·상세 연결·저장·필터를 확인한다. 수행 결과와 배포 상태는 CHECK.md에 기록한다.
