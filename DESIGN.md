# DESIGN — JOBTIME 개인 취업 캘린더

상태: 구현 기준 설계
기준 문서: [PRD.md](./PRD.md)
시간대: KST(Asia/Seoul)

## 1. 현재 구조와 구현 경계

현재 프로젝트는 다음 구조다.

- `app/page.tsx`: 공식 검색, 단일 공고 선택, 개인 보드, D-day, 상태, 메모, 삭제
- `app/api/search/route.ts`: 지원되는 공식 사이트 검색
- `app/api/state/route.ts`: 개인 공고 상태 읽기·쓰기
- `lib/jobs.ts`: v1 타입, 날짜 검증, D-day, 공식 기간 분석
- `lib/providers.ts`: KB·IBK·NH 공식 공고 공급자
- `lib/store.ts`: 현재 D1 단일 JSON 상태 저장
- `app/globals.css`: 시스템 글꼴 기반 반응형 스타일

현재 구현 타입은 `Store.version: 1`, `Posting.stage: 관심 | 지원 준비 | 지원 완료`다. 전형, 캘린더, 수동 등록 UI는 없다. 아래 내용은 다음 구현 단계의 설계이며 현재 완성 기능으로 간주하지 않는다.

기존 문서의 목표 저장소는 `.local-data/jobs.json`이지만 현재 코드와 배포본은 Vinext·D1을 사용한다. 저장 어댑터를 제외한 도메인 모델과 UI 설계는 공통으로 사용한다. 구현 전 저장소 방향 결정을 필수 게이트로 둔다.

## 2. 정보 구조와 내비게이션

최상위 내비게이션:

1. **대시보드**: 진행 현황과 다음 행동
2. **캘린더**: 월간·주간·목록 일정
3. **내 공고**: 전체 공고 검색·필터

공통 헤더에는 로고, 세 화면 탭, `내 공고 추가` 행동을 둔다. 모바일에서는 탭을 하단 내비게이션으로 옮긴다. 공고 상세는 세 화면이 공유한다. 데스크톱은 우측 패널, 직접 URL과 모바일은 전체 화면을 사용한다.

권장 경로:

- `/`: 대시보드
- `/calendar?view=month|week|list&date=YYYY-MM-DD`
- `/applications`
- `/applications/[applicationId]`

## 3. 대시보드

### 3.1 구성

1. 오늘 날짜와 안내
2. 요약: 전체, 지원 준비, 지원 중, 3일 이내 모집 마감
3. 다음 주요 시험·면접·결과 발표
4. 마감 임박 공고
5. 진행 중 공고
6. 종료 공고 접기 영역

공고 카드는 기업명, 공고명, 전체 관리 상태, 모집 마감과 D-day, 현재 전형, 다음 예정 일정을 우선 표시한다. 모든 전형은 상세에서 보여준다. 날짜가 없으면 `일정 미공개`, 시각이 없으면 `시간 미공개`로 표시한다. 모집이 끝나도 `지원 중` 공고는 진행 영역에 남는다.

통계 정의:

- 전체: 삭제되지 않은 모든 공고
- 지원 준비: `managementStatus === "preparing"`
- 지원 중: `managementStatus === "active"`
- 3일 이내 마감: 아직 지나지 않은 모집 마감이 72시간 이내. 시각이 없으면 날짜 차이 사용
- 종료: `accepted | rejected | withdrawn`

## 4. 캘린더

### 4.1 공통 도구막대

- 월간·주간·목록 보기
- 오늘, 이전, 다음, 날짜 선택
- 기업 다중 선택 필터
- 일정 유형 토글: 모집, 마감, 시험, 면접, 결과, 개인

필터와 선택 날짜는 URL 검색 파라미터에 저장해 새로고침 후 복원하되 제품 데이터에는 넣지 않는다.

### 4.2 월간 보기

- 데스크톱 7열, 셀 최소 높이 112px
- 일정은 기업명 축약, 유형 라벨, 시각 또는 종일 표시
- 셀당 기본 3개, 나머지는 `+N개 더보기`
- 기간 일정은 주 단위 연속 막대로 표시하고 월 경계를 이어서 표현
- 날짜 클릭 시 그날 일정 목록 패널
- 모바일은 날짜와 일정 개수·상태 점을 보여주고 선택 날짜 목록을 아래에 표시

### 4.3 주간 보기

- 데스크톱은 7일 열과 시간 축
- 날짜 전용 일정은 상단 종일 영역
- 시각 일정은 시간 축, 여러 날 일정은 기간 영역
- 겹친 일정은 너비를 나눠 배치
- 모바일은 7열 시간표 대신 날짜별 세로 그룹

### 4.4 목록 보기

- 날짜별 그룹
- 행에는 시각/종일, 기업, 유형, 전형 또는 공고명, 예정 여부 표시
- 월 단위 이전·다음과 명시적 더 보기 사용
- 모바일 캘린더 기본 보기

### 4.5 상호작용

- 일정 클릭 → `EventDetailPanel`
- 파생 일정 수정 → 연결 공고 또는 전형 편집
- 개인 일정 수정 → `PersonalEventForm`
- 저장 성공 후 원본을 다시 읽고 파생 이벤트 재계산
- 드래그 앤 드롭은 MVP 제외

## 5. 공고 추가·수정·삭제

### 5.1 방식 선택

`내 공고 추가`에서 다음 중 하나를 선택한다.

- **공식 공고 검색**: 기업명 또는 지원되는 공식 URL
- **직접 등록**: 모든 기업과 공고

### 5.2 공식 검색

1. 기업명 또는 URL 입력
2. 검색 중 입력·버튼 잠금
3. 후보 카드 목록 표시
4. 한 후보 선택
5. 중복 검사
6. 전체 상태와 메모 확인
7. 저장

선택하지 않은 후보는 저장하지 않는다.

### 5.3 직접 등록

- 기본: 기업명, 공고명, 직무, 채용 구분
- 모집: 시작 날짜·시각, 마감 날짜·시각
- 참고: 선택 HTTPS URL, 메모
- 관리: 최초 전체 상태

날짜가 비어 있으면 시각 입력을 비활성화한다. 날짜를 지울 때 기존 시각도 함께 지운다는 사실을 알린다. 기업명과 공고명만으로 저장할 수 있다.

### 5.4 수정과 출처

- 공식 필드에는 출처 배지를 표시한다.
- 공식 일정을 수정하면 `source: user_override`와 원래 공식 값을 함께 보존한다.
- `공식 값으로 되돌리기`를 제공한다.
- 수동 공고는 모든 필드를 수정할 수 있다.
- 저장 실패 시 입력을 유지한다.

### 5.5 삭제

확인 창에 기업·공고명, 전형 수, 파생 일정 수, 개인 일정 수를 표시한다. 확인 후 공고와 연결 데이터를 한 원자 작업으로 삭제한다. 실패하면 기존 상태를 유지한다.

## 6. 공고 상세

데스크톱은 기본·모집·상태·메모와 전형 타임라인을 2열로 배치한다. 모바일은 핵심 요약, 상태, 전형, 일정, 메모, 수정·삭제 순서의 1열이다.

전형 행에는 순서, 이름, 상태, 날짜, 현재 단계 표시가 있으며 클릭하면 편집 영역이 열린다.

## 7. 전형 UI와 규칙

각 전형에 상태 선택과 `현재 단계로 지정`을 둔다.

- 완료: 응시·제출 완료이며 결과 미확정
- 합격·불합격: 결과 확인일 선택 입력
- 해당 없음: 데이터는 보존하고 기본 화면에서 접기
- 현재 단계 지정: 다른 전형의 현재 표시만 해제하며 상태는 자동 변경하지 않음

`전형 구성 편집` 보조 패널에서 추가, 이름 수정, 위·아래 이동, 해당 없음, 삭제를 제공한다. 드래그만 제공하지 않는다. 일정·결과·메모가 있는 전형 삭제는 영향 안내와 확인이 필요하다.

신규 공고에는 서류 제출, AI 역량검사, 필기 전형, 1차 면접, 2차 면접, 최종면접을 각각 새 UUID로 복사한다. 템플릿 변경은 기존 공고에 소급하지 않는다.

## 8. 날짜·시간 입력

공통 `DateTimeRangeField`는 날짜 없음, 날짜만, 날짜+시각, 단일 시점, 범위, 예정/확정을 지원한다.

- 날짜: `YYYY-MM-DD`
- 시각: `HH:mm` 또는 `null`
- 시간대: `Asia/Seoul`
- 날짜만 있는 마감은 당일에 마감으로 단정하지 않고 다음 날부터 지난 일정으로 분류
- 시작·종료가 모두 있으면 시작이 종료보다 늦지 않아야 함
- 월말·연말을 넘는 기간 지원

## 9. 데이터 모델

```ts
type DateTimePoint = {
  date: string;
  time: string | null;
  timezone: "Asia/Seoul";
};
type DateTimeRange = {
  start: DateTimePoint | null;
  end: DateTimePoint | null;
  tentative: boolean;
};
type ManagementStatus =
  | "interested" | "preparing" | "active"
  | "accepted" | "rejected" | "withdrawn";
type StageStatus =
  | "not_started" | "scheduled" | "in_progress"
  | "completed" | "passed" | "failed" | "not_applicable";
type DataOrigin = "official" | "manual" | "user_override";

type JobApplication = {
  id: string;
  companyName: string;
  postingTitle: string;
  role: string | null;
  employmentType: string | null;
  postingUrl: string | null;
  origin: "official" | "manual";
  provider: "kb" | "ibk" | "nh" | null;
  officialPostingId: string | null;
  recruitment: DateTimeRange;
  recruitmentOrigin: DataOrigin;
  officialRecruitmentSnapshot: DateTimeRange | null;
  evidence: string | null;
  officialCheckedAt: string | null;
  managementStatus: ManagementStatus;
  currentStageId: string | null;
  notes: string;
  stages: ApplicationStage[];
  personalEvents: PersonalEvent[];
  createdAt: string;
  updatedAt: string;
};
type ApplicationStage = {
  id: string;
  name: string;
  order: number;
  status: StageStatus;
  applicable: boolean;
  schedule: DateTimeRange;
  resultExpectedAt: DateTimePoint | null;
  resultConfirmedAt: DateTimePoint | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type PersonalEvent = {
  id: string;
  applicationId: string;
  title: string;
  schedule: DateTimeRange;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type JobStoreV2 = {
  version: 2;
  applications: JobApplication[];
  migration?: { migratedFrom: 1; migratedAt: string; backupFile: string };
};
```

불변식:

- 모든 ID는 생성 후 변경하지 않는다.
- `currentStageId`는 같은 공고의 적용 전형 ID 또는 `null`이다.
- 현재 전형은 `applicable: true`이고 `not_applicable`이 아니다.
- 전형 `order`는 0부터 중복 없이 정규화한다.
- URL은 `null` 또는 HTTPS다.
- 종료 상태는 모집 마감으로 자동 결정하지 않는다.

## 10. 캘린더 파생 모델

```ts
type CalendarEventType =
  | "recruitment_period" | "recruitment_start" | "recruitment_deadline"
  | "stage_schedule" | "result_expected" | "result_confirmed" | "personal";
type DerivedCalendarEvent = {
  id: string;
  applicationId: string;
  stageId: string | null;
  type: CalendarEventType;
  companyName: string;
  title: string;
  schedule: DateTimeRange;
  tentative: boolean;
};
```

모집 이벤트는 공고에서, 전형·결과 이벤트는 전형에서, 개인 이벤트는 개인 일정에서 파생한다. 원본 날짜가 없으면 만들지 않는다. 여러 표시 이벤트가 있어도 수정 대상은 항상 원본 하나다.

## 11. 상태 변경과 저장 흐름

1. 클라이언트 폼 검증
2. 저장 버튼 잠금과 요청 ID 부여
3. 서버에서 길이, enum, URL, 날짜 범위, 참조 ID 재검증
4. 저장 어댑터가 최신 v2 상태 읽기
5. 변경 적용과 전체 불변식 검증
6. 로컬 JSON이면 순차 큐에서 임시 파일 쓰기와 원자 교체
7. 성공 응답으로 화면 상태 갱신
8. 통계와 캘린더 이벤트 재계산
9. 실패 시 입력 보존과 기존 상태 복원

## 12. 저장 어댑터와 마이그레이션

```ts
interface JobStoreRepository {
  read(): Promise<JobStoreV2>;
  update(change: (state: JobStoreV2) => JobStoreV2): Promise<JobStoreV2>;
  export(): Promise<string>;
}
```

### 12.1 로컬 JSON 목표

- 기본: `.local-data/jobs.json`
- 백업: `.local-data/jobs.v1.<timestamp>.backup.json`
- 같은 디렉터리의 UUID 임시 파일
- 읽기 → 검증 → 백업 → 변환 → v2 검증 → 임시 쓰기 → rename
- 실패 시 원본 유지, 손상 JSON을 빈 상태로 대체하지 않음

### 12.2 v1 변환

- `Posting.id`, 제목, URL, 시작·마감, 메모, 출처 보존
- 회사 ID로 `Company.name`을 찾아 `companyName` 생성
- `관심` → `interested`
- `지원 준비` → `preparing`
- `지원 완료` → `active`와 ‘서류 제출’ `completed`
- 나머지 기본 전형의 일정·결과는 만들지 않음
- 공식 식별값은 URL에서 안전하게 확인할 때만 보존

### 12.3 현재 D1과의 조정

현재 `lib/store.ts`는 v1 JSON을 D1 `app_state` 한 행에 저장한다. D1을 유지하면 v2 모델을 쓰되 파일 백업은 버전 스냅샷 또는 내보내기로 대체한다. 로컬 JSON과 D1 동시 쓰기는 금지한다.

## 13. API

- `GET /api/state`
- `POST /api/search`
- `POST /api/applications`
- `PATCH /api/applications/:id`
- `DELETE /api/applications/:id`
- `POST/PATCH/DELETE /api/applications/:id/stages[...]`
- `POST/PATCH/DELETE /api/applications/:id/events[...]`
- `GET /api/export`

모든 변경 요청은 같은 출처, JSON Content-Type, 크기, URL, enum을 검사한다. 수동 URL은 서버가 방문하지 않는다.

## 14. 컴포넌트

- `AppHeader`, `PrimaryNavigation`, `MobileNavigation`
- `DashboardStats`, `ApplicationCard`, `NextEventCard`
- `CalendarToolbar`, `MonthCalendar`, `WeekCalendar`, `AgendaList`
- `CalendarEventChip`, `DayEventPanel`
- `AddApplicationDialog`, `OfficialSearchForm`, `ManualApplicationForm`
- `ApplicationDetail`, `StageTimeline`, `StageRow`, `StageEditor`
- `DateTimePointField`, `DateTimeRangeField`
- `ManagementStatusSelect`, `StageStatusSelect`
- `PersonalEventForm`, `DeleteImpactDialog`
- `LoadingState`, `EmptyState`, `InlineError`, `SaveStatus`

현재 전용 캘린더 라이브러리는 설치되어 있지 않다. MVP는 날짜 유틸리티와 CSS Grid로 구현한다. 주간 겹침 계산이 복잡해질 때 번들 크기와 접근성을 비교한 뒤 도입 여부를 결정한다.

## 15. 로딩·빈 상태·오류

- 초기 로딩: 크기가 유지되는 스켈레톤
- 빈 보드: 공식 검색과 직접 등록 제공
- 빈 필터: 필터 해제 제공
- 저장 중: 해당 폼만 잠금
- 성공: 짧은 상태 알림
- 실패: 입력 유지와 재시도
- 검색 일부 실패: 성공 결과와 경고 동시 표시
- 데이터 손상: 빈 상태로 진입하지 않고 복구 안내
- 마이그레이션 실패: 백업 위치와 원본 보존 상태 표시

## 16. 반응형·접근성

- 시스템 글꼴과 명확한 포커스 링 유지
- 아이콘 버튼, 입력, 오류에 접근 가능한 이름과 연결된 라벨 제공
- 상태는 색상과 텍스트·아이콘을 함께 사용
- 모달 포커스 트랩과 닫은 뒤 포커스 복귀
- 캘린더 셀과 이벤트를 키보드로 이동하고 Enter로 상세 열기
- 순서 변경은 위·아래 버튼도 제공
- 저장·검색 결과만 `aria-live`로 알림
- 터치 대상 최소 44×44px 권장
- `prefers-reduced-motion`에서 장식 동작 제거
- 모바일 월간 셀은 텍스트 축소 대신 선택 날짜 목록 제공

## 17. 구현 순서

1. 저장소 방향 결정과 v2 타입
2. 검증·파생 이벤트 함수
3. v1 백업·마이그레이션
4. 수동 공고 CRUD
5. 전체 상태·전형 CRUD
6. 전형·결과·개인 일정
7. 공고 상세
8. 대시보드 통계
9. 월간 캘린더
10. 주간·목록 보기
11. 필터·반응형·접근성
12. 공식 검색 회귀와 날짜 경계 검증

각 단계는 데이터 보존 검증을 통과한 뒤 다음 단계로 진행한다.
