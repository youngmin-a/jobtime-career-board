# CHECK — 취준캘린더 v2 검증

검증일: 2026-09-09 · 실제 실행한 결과만 기록

## 저장소 및 마이그레이션
- 운영: Workers/Vinext, DB D1 바인딩, v1 app_state 확인. 배포 직전 재조회도 0행.
- 로컬: 기존 공고 1건 → v2 1건 이전. app_state 원문과 legacy-v1 백업 payload 동일함 확인.
- 로컬 JSON 파일로 복귀하거나 운영 이중 쓰기를 만들지 않음.
- 추가형 스키마 0002(workspace_state/workspace_backups) 생성·로컬 적용 성공. 0000·0001 변경 없음.
- 추가형 스키마 0003(named_spaces/name_sessions/name_imports) 생성·로컬 적용 성공. 0002와 기존 레거시 테이블 변경 없음.
- 변경 전 상태의 자동 스냅샷과 복구 API 구현. 실제 운영 복구는 실행하지 않음.

## 자동 검증
- npm run test: 25개 통과, 실패 0.
- 실제 node:sqlite 트랜잭션에 쓰기 실패 주입: 기존 공고·메모·revision 유지. 작업공간 간 데이터 격리와 계정 작업공간 레거시 이전도 통과.
- 이름 정규화·같은 이름 작업공간 연결 규칙, 빠른 진행 패치의 상세 초안 분리, 2026년 하반기 범위와 마감 공고 포함, 우리은행 공식 마감 원문·국민은행 마감 상태 파서를 검증함.
- v1 메모·ID·초 보존, 손상 데이터 초기화 거부, 스냅샷 복구 시 현재 상태 재백업 통과.
- 미공개 날짜/시각, KST 당일/다음날 마감, 오늘 지난 시각 제외, 역전 범위 거부 통과.
- 완료/합격 분리, 현재 전형 해당 없음 거부, 순서/ID/일정 보존, 월 경계 이벤트 통과.
- npm run typecheck: 통과.
- npm run lint: 통과.
- npm run build: Workers 서버와 클라이언트 빌드 성공.
- Vinext 경고: / 라우트의 동적 API 정적 분석 분류 제한. 빌드 실패 없음.

## 실제 로컬 API 통합
- 수동 공고 최소 등록 → 상태·전형·시험·결과·개인 일정 수정 → GET 비교 통과.
- 오래된 revision 409, 역전 날짜 400, 실패 뒤 기존 데이터 유지 통과.
- UI 메모 저장 뒤 API 확인 → 개발 프로세스 종료/재시작 → 전체 상태 동일 비교 통과.
- 검증용 공고 삭제 뒤 기존 사용자 공고만 그대로 남음.
- 공식 검색: 국민 7개, 기업 6개, 농협 2개 후보를 확인했던 기존 결과를 유지함. 검색 범위는 2026년 하반기이며 마감 상태도 후보로 남기고, 일부 일정 해석 경고가 있어 미공개 정보를 유지함.
- 공식 검색 자체가 저장하지 않음, 기업은행 후보 하나 선택 시 한 건만 저장, 공식 마감 값 보존 확인. 검증 선택 건만 삭제함.
- 로그인 없는 로컬 브라우저 세션에서 Set-Cookie 발급 → 최소 입력 공고 저장 → 같은 쿠키 재조회 1건, 다른 쿠키 재조회 0건을 확인함.
- 이름 진입·세션 태그 기반 요청 경로는 도메인 테스트와 코드 검토로 확인함. 실제 공개 운영에서 서로 다른 이름의 계정 격리와 다른 기기 재접속은 배포 후 수동 확인이 남아 있음.

## 화면 검증
- 대시보드 기존 공고·D-day·정확한 모집 시각·남은 시간 표시 확인.
- 월간 시험 일정 클릭 → 해당 공고·필기 전형 상세 → 메모 저장 성공.
- PC 1365px, 모바일 390px 뷰포트에서 달력 확인. 문서 가로 스크롤 없음.
- 모바일 주간 날짜별 목록, 월간 일정 개수/날짜 목록, 월별 목록 확인.
- 기업 필터와 시험 유형 제외 시 해당 이벤트 제외 확인.
- 자동 모바일 실기기 테스트, 모든 브라우저, 대량 500건 성능, 운영 장애 주입은 실행하지 않음.
- 이름 기반 세션의 브라우저 간 실제 운영 접근, 500건 대량 페이지 성능, 운영 장애 주입은 실행하지 않음.

## 변경 파일
app/page.tsx, app/editor.tsx, app/calendar.tsx, app/globals.css, app/layout.tsx
app/api/state/route.ts, app/api/search/route.ts, app/api/export/route.ts
lib/applications.ts, lib/repository.ts, lib/store.ts
db/schema.ts, drizzle/0001_windy_vargas.sql, drizzle/meta
tests/domain.test.ts, scripts/test.mjs, scripts/integration.mjs
PRD.md, DESIGN.md, PLAN.md, MIGRATION.md, README.md, package.json, tsconfig.json, .gitignore

## 배포
이 기록은 코드 변경 검증 후 배포 직전에 갱신했다. 최종 배포 및 운영 API 확인 결과는 DEPLOYMENT.md에 기록한다.
토큰 재설정은 사용하지 않았다.

## 2026-09-09 미구현 요구사항 보완 검증
- `npm run typecheck`: 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과. Vinext의 동적 API 라우트 분류 경고만 출력됨.
- `npm test` 직접 실행은 이 샌드박스에서 esbuild가 프로젝트 경로를 해석하지 못해 실패했으며, 동일 `tests/domain.test.ts`를 esbuild로 번들해 Node로 실행한 대체 검증은 25/25 통과.
- 공개 Sites 배포 버전 11이 `527b43f32a67e1c748dd9723687efbb903bd58f9` 소스와 일치하고 `https://jobtime-career-board.bmec3132.chatgpt.site`에서 HTTP 200, `<title>취준캘린더</title>`, 새 브랜드 포함을 확인함.
- 이번 보완에는 운영 D1 마이그레이션을 추가하지 않았으며, 기존 스테이지 메모 필드는 삭제하지 않고 UI에서만 숨김.
- 네이버 API HUB 응답 HTML 제거·접수기간 추출 단위 테스트를 추가했다. 외부 네이버/Tavily 호출은 비밀키 미설정 상태라 실행하지 않았다.
- GitHub Actions는 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `TAVILY_API_KEY`와 기존 선택 키를 값이 있을 때만 Worker Secret으로 주입한다.

## 2026-09-08 리디자인 검증
도메인 테스트 15개, typecheck, lint, production build 통과. 실제 칸반 드래그 후 저장 및 기존 전형 완료 상태 보존 확인. 모집 기간 반복 제거와 실제 전형 일정 표시 확인. 현대자동차·청년인턴·우리은행 실제 검색, 선택한 한 건 편집 저장 및 삭제 확인. 기존 로컬 공고 보존, 검증용 공고 정리 완료. 공개 전환 결과는 DEPLOYMENT.md에 기록.

## 2026-09-11 캘린더 실행·공고 분석 확장
- `npm test`: 35/35 통과. 기존 v1/v2·D1 실패 원복과 함께 준비 항목 이동, 의미 색상 분류, ICS 날짜/UID, 내부 주소 차단, 붙여넣기 출처, AI 날짜 근거 검증을 확인했다.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: 통과. Vinext의 동적 라우트 분류 안내만 있으며 빌드 실패는 없다.
- 로컬 브라우저에서 새 제목과 이름 진입 화면 렌더링을 확인했다. 관리형 로컬 D1에 앱 마이그레이션이 준비되지 않아 새 테스트 이름의 저장 UI 검증은 중단했으며 운영 데이터로 대체 테스트하지 않았다.
- 신규 SQL은 `analysis_usage` 호출 카운터 테이블만 추가한다. 기존 `workspace_state`, 백업, 공고 payload 구조는 변경하지 않는다. 원격 마이그레이션과 운영 URL 결과는 GitHub Actions 완료 후 확인한다.
- 실제 OpenAI 구조화 활성 여부는 배포 Worker의 Secret 상태로 판정하며, 활성 확인 전에는 원문 규칙 분석 대체 경로만 검증 완료로 기록한다. 토큰 재설정은 사용하지 않았다.
