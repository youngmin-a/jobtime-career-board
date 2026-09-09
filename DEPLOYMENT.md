# JOBTIME v2 배포 결과

2026-09-08 KST. 기존 JOBTIME 주소에 배포 성공.
https://jobtime-career-board.bmec3132.chatgpt.site

## 배포된 소스
- 앱 커밋: 55c0e445f284df8375b7ce8b0ded7e6e4330a49e
- Sites 버전: 2
- 운영 런타임: Vinext / Cloudflare Workers, D1 DB
- 접근: 기존 소유자 전용 설정 유지

## 운영 데이터 이전
- 배포 직전 app_state 0행을 재확인하고 조회 결과를 backups/production-before-v2.json에 보관(Git 제외).
- 0001 추가형 마이그레이션 적용 후 app_state, job_state_v2, job_backups 확인.
- v2 초기화 성공. 운영 기존 공고가 없어 변환할 운영 레코드는 0건.
- 검증 종료 시 v2 공고 0건, revision 5. 검증용 수동·공식 공고만 생성 후 삭제함.
- 기존 app_state는 여전히 0행이며 변경하지 않음.
- 로컬 기존 공고 1건 이전 및 원본-백업 일치 검증은 CHECK.md에 기록.

## 운영 검증
- 수동 최소 등록 및 전형·개인 일정 수정 성공.
- 여러 요청과 브라우저 조회 후 공고·전형·일정 값 유지 확인.
- 오래된 revision은 409, 잘못된 날짜는 400. 기존 데이터 유지.
- 검증용 수동 공고 삭제와 재조회 성공.
- 공식 검색: 국민 7, 기업 6, 농협 2 후보. 일부 날짜 해석 경고 유지.
- 공식 검색 자체는 저장하지 않음. 후보 하나만 저장되고 원래 마감 정보 유지. 검증 선택 건 삭제 성공.
- 실제 배포 페이지에서 저장된 공고와 현재 전형, 다음 일정이 표시되는 것을 확인.
- 소유자 인증을 유지했으며 인증 토큰은 소스·파일에 저장하지 않음.

## 수행하지 않은 항목
실제 운영 D1 장애 주입, 운영 프로세스 강제 재시작, 운영 백업 복구 실행, 모바일 실기기·모든 브라우저 검증은 하지 않았다. 로컬 프로세스 재시작, SQLite 쓰기 실패 주입 및 복구 테스트, PC/모바일 뷰포트 검증은 통과했다.

토큰 재설정은 사용하지 않았다.

## 취준캘린더 2026 하반기 검색·이름 공간 보완

2026-09-09 KST. 중단된 구현을 재개해 이름 기반 개인 공간, 빠른 전형 상태 변경, 2026년 하반기·마감 포함 검색을 기존 공개 사이트와 Worker에 반영했다.

- GitHub 커밋: fc9802b6e010d29bfda8f753990a93598f92caa6
- GitHub Actions 실행: 34301827286 (typecheck·lint·25개 test·build·D1 0003·Worker deploy 모두 성공)
- Sites 버전: 7, 배포 성공
- 공개 주소: https://jobtime-career-board.bmec3132.chatgpt.site
- Worker 주소: https://jobtime-career-board.bmec3132.workers.dev
- 접근: Sites는 기존 public 정책을 유지한다. 첫 화면에서 이름 또는 별명을 입력하며, 같은 이름은 같은 D1 `named_spaces`로 연결된다. 세션 태그 없는 요청은 상태 조회·변경을 거부한다.
- D1: 기존 `app_state`, `job_state_v2`, `workspace_state`, `workspace_backups`를 보존하고 0003에서 `named_spaces`, `name_sessions`, `name_imports`만 추가했다. 기존 브라우저 기록은 사용자가 선택한 경우에만 백업 후 한 번 가져온다.
- 기능: 캘린더 첫 화면, 공고별 현재 전형·진행 상태 빠른 저장, 서류 제출 완료와 합격 분리, 2026 H2·마감 포함 검색 및 추가 페이지, 우리은행 공식 마감 원문, 이름 전환·선택적 레거시 가져오기.
- 로컬 검증: `npm test` 25/25, `npm run typecheck`, `npm run lint`, `npm run build` 통과. 운영 D1 장애 주입·실기기 접근성·대량 500건 성능 검증은 실행하지 않았다.

## JOBTIME v3 리디자인·공개 전환

2026-09-08 KST. 리디자인과 범용 채용공고 검색을 기존 주소에 반영했다.

- 앱 커밋: 3c842e96402b691390fb377ab0b740cbf12bd190
- Sites 버전: 3
- 운영 런타임·저장소: Vinext / Cloudflare Workers / D1 단일 영속 저장소
- 접근: 공개 조회(public), 수정·삭제는 `JOBTIME_OWNER_ID` 소유자만 가능
- 검색: 인크루트 공개 검색과 KB·IBK·NH 공식 어댑터. 공개 검색은 최대 20개 후보이며, 날짜·시간이 원문에 없으면 비워 둔다.
- 검증: 도메인 테스트 15개, typecheck, lint, production build, 실제 칸반 이동 저장, 캘린더·검색·선택 저장 흐름 통과.
- 공개 전환 후 익명 `GET /`, `GET /api/state`, `GET /api/access`는 200이며 익명 `POST /api/state`는 403이다.
- 공개 전환 직전 D1 백업을 `backups/pre-redesign-production.json`에 보관했다(Git 제외). 백업 당시 revision 6, 공고 1건.

## JOBTIME v4 로그인 없는 개인 작업공간

2026-09-08 KST. GitHub `main` push로 Cloudflare Worker에 자동 배포했다.

- 앱 커밋: 752cb24aec578d7a8e631e5dda81ff58cfe7a8ee
- Cloudflare 주소: https://jobtime-career-board.bmec3132.workers.dev
- Actions 실행: 34198674818 (typecheck·lint·test·build·원격 D1 0002·deploy 모두 성공)
- 저장소: 기존 Cloudflare D1 `env.DB` 단일 저장소 유지. `workspace_state`·`workspace_backups`를 추가하고 레거시 테이블은 보존했다.
- 데이터 이전: 플랫폼 계정 작업공간 최초 읽기 때만 기존 v2/v1을 백업 후 이전한다. 익명 브라우저는 빈 작업공간으로 시작해 기존 개인 데이터를 읽지 않는다.
- 공개 접근: 로그인 없이 누구나 URL에 접속하며, 브라우저별 HttpOnly·Secure·SameSite 쿠키로 CRUD 범위를 분리한다. 다른 브라우저의 공고·전형·일정·메모는 노출되지 않는다.
- 배포 검증: Worker `GET /api/state` 200, 같은 쿠키 revision 유지, 다른 쿠키 공고 0건, Set-Cookie 보안 속성 확인.

## 2026-09-09 미구현 요구사항 보완

- 전형 편집은 상태와 날짜 중심으로 간소화했다. 모집 일정의 시작·마감 시각은 유지하고, 후속 전형의 시각·메모 입력 UI는 제거했으며 기존 저장값은 보존한다.
- 상세 전형 상태·현재 전형·전체 관리 상태 조작을 모두 `patch-progress` 즉시 저장 경로로 통일했다. 캘린더에는 앞으로 7일의 미처리 일정과 일정 이동 되돌리기를 제공한다.
- 하반기 검색은 제목 연도보다 실제 접수 시작일을 우선한다. 2027년 제목이어도 2026년 7~12월 시작이면 포함하고, 시작일 미확인 후보는 별도 표시한다.
- URL 등록은 `job.incruit.com`, KDB·iM뱅크·금감원 공식 호스트의 원문 해석을 시도하며 실패 시 입력 URL과 확인된 제목·기업명을 수동 등록에 전달한다. 산업은행·iM뱅크·금감원 별칭·관련도 필터와 공식 경로를 추가했다.
- Brave 웹 검색과 ALIO API는 서버 환경변수가 있을 때만 활성화된다. 현재 배포에는 해당 키가 없어 외부 검색 열기와 공식 경로만 제공한다.

- 최종 공개 배포: Sites 버전 11, 커밋 `527b43f32a67e1c748dd9723687efbb903bd58f9`, 배포 성공. 공개 URL과 D1 바인딩은 기존 값을 유지한다.

- 네이버·Tavily 연동 코드는 서버 Secret이 있을 때만 활성화된다. 현재 키를 배포하지 않아 공개 서비스는 기존 공식·공개 검색과 수동 URL 등록으로 동작한다. GitHub Actions에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `TAVILY_API_KEY`(선택) Secret을 추가하면 다음 `main` 배포부터 Worker에 주입된다.
