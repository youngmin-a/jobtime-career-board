# CHECK — JOBTIME v2 검증

검증일: 2026-09-08 · 실제 실행한 결과만 기록

## 저장소 및 마이그레이션
- 운영: Workers/Vinext, DB D1 바인딩, v1 app_state 확인. 배포 직전 재조회도 0행.
- 로컬: 기존 공고 1건 → v2 1건 이전. app_state 원문과 legacy-v1 백업 payload 동일함 확인.
- 로컬 JSON 파일로 복귀하거나 운영 이중 쓰기를 만들지 않음.
- 추가형 스키마 0001 생성·로컬 적용 성공. 0000 변경 없음.
- 변경 전 상태의 자동 스냅샷과 복구 API 구현. 실제 운영 복구는 실행하지 않음.

## 자동 검증
- npm run test: 11개 통과, 실패 0.
- 실제 node:sqlite 트랜잭션에 쓰기 실패 주입: 기존 공고·메모·revision 유지.
- v1 메모·ID·초 보존, 손상 데이터 초기화 거부, 스냅샷 복구 시 현재 상태 재백업 통과.
- 미공개 날짜/시각, KST 당일/다음날 마감, 오늘 지난 시각 제외, 역전 범위 거부 통과.
- 완료/합격 분리, 현재 전형 해당 없음 거부, 순서/ID/일정 보존, 월 경계 이벤트 통과.
- npm run typecheck: 통과.
- npm run lint: 통과.
- npm run build: Workers 서버와 클라이언트 빌드 성공.
- Vinext 경고: 플러그인 소요시간 및 / 라우트의 정적 분석 분류 제한. 빌드 실패 없음.

## 실제 로컬 API 통합
- 수동 공고 최소 등록 → 상태·전형·시험·결과·개인 일정 수정 → GET 비교 통과.
- 오래된 revision 409, 역전 날짜 400, 실패 뒤 기존 데이터 유지 통과.
- UI 메모 저장 뒤 API 확인 → 개발 프로세스 종료/재시작 → 전체 상태 동일 비교 통과.
- 검증용 공고 삭제 뒤 기존 사용자 공고만 그대로 남음.
- 공식 검색: 국민 7개, 기업 6개, 농협 2개 후보. 일부 일정 해석 경고가 있어 미공개 정보를 유지함.
- 공식 검색 자체가 저장하지 않음, 기업은행 후보 하나 선택 시 한 건만 저장, 공식 마감 값 보존 확인. 검증 선택 건만 삭제함.

## 화면 검증
- 대시보드 기존 공고·D-day·정확한 모집 시각·남은 시간 표시 확인.
- 월간 시험 일정 클릭 → 해당 공고·필기 전형 상세 → 메모 저장 성공.
- PC 1365px, 모바일 390px 뷰포트에서 달력 확인. 문서 가로 스크롤 없음.
- 모바일 주간 날짜별 목록, 월간 일정 개수/날짜 목록, 월별 목록 확인.
- 기업 필터와 시험 유형 제외 시 해당 이벤트 제외 확인.
- 자동 모바일 실기기 테스트, 모든 브라우저, 대량 500건 성능, 운영 장애 주입은 실행하지 않음.

## 변경 파일
app/page.tsx, app/editor.tsx, app/calendar.tsx, app/globals.css, app/layout.tsx
app/api/state/route.ts, app/api/search/route.ts, app/api/export/route.ts
lib/applications.ts, lib/repository.ts, lib/store.ts
db/schema.ts, drizzle/0001_windy_vargas.sql, drizzle/meta
tests/domain.test.ts, scripts/test.mjs, scripts/integration.mjs
PRD.md, DESIGN.md, PLAN.md, MIGRATION.md, README.md, package.json, tsconfig.json, .gitignore

## 배포
이 기록은 검증 완료 후 배포 직전 작성했다. 최종 배포 및 운영 API 확인 결과는 DEPLOYMENT.md에 기록한다.
토큰 재설정은 사용하지 않았다.

## 2026-09-08 리디자인 검증
도메인 테스트 15개, typecheck, lint, production build 통과. 실제 칸반 드래그 후 저장 및 기존 전형 완료 상태 보존 확인. 모집 기간 반복 제거와 실제 전형 일정 표시 확인. 현대자동차·청년인턴·우리은행 실제 검색, 선택한 한 건 편집 저장 및 삭제 확인. 기존 로컬 공고 보존, 검증용 공고 정리 완료. 공개 전환 결과는 DEPLOYMENT.md에 기록.
