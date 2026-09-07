# JOBTIME D1 이전·백업·롤백

2026-09-08. 운영은 Sites 프로젝트 appgprj_6a9e968aa7f081918fbef4cc0f58a84e의 DB 바인딩을 계속 사용한다.

## 변경 전 확인
실제 운영 테이블 app_state(id,payload,updated_at)를 조회했으며 확인 시점에는 0행이었다. 로컬 개발 D1에는 공고 1건이 있었다. 로컬과 운영은 별도 DB다.
추가 마이그레이션은 app_state를 건드리지 않고 job_state_v2와 job_backups만 만든다. 최신 운영 행은 배포 직전 다시 확인한다.

## 백업 및 이전
1. 기존 사이트의 /api/state 응답 또는 Sites D1 테이블 조회로 원본을 보관한다. 로컬 보관 파일 backups/는 Git에서 제외한다.
2. drizzle/0001_windy_vargas.sql 적용. 기존 0000 파일은 변경하지 않는다.
3. 최초 v2 API 요청에서 v1 원본을 검증한다. 기존 값이 있으면 job_backups의 legacy-v1에 원문을 보관한다.
4. 원본 백업과 v2 INSERT를 D1 batch로 실행한다. 원본 app_state는 동결 보관한다.
5. v2를 재조회하여 검증한다. 실패 시 원본을 유지하고 오류를 반환한다.
6. 일반 저장·삭제·복구 전에도 job_backups에 직전 v2 스냅샷을 보관한다.

마이그레이션은 기존 공고 ID·제목·URL·날짜·시각·초·메모·공식 근거를 유지한다. 지원 완료는 지원 중과 서류 제출 완료로 옮긴다. 전형 결과는 추론하지 않는다.

## 데이터 롤백 절차
실제 운영 롤백은 자동 실행하지 않는다. 복구 대상과 최신 변경 내용을 먼저 확인한다.
1. /api/export로 현재 상태를 별도 다운로드한다.
2. Sites 설정의 D1 테이블 보기 또는 read_database_table_rows 도구로 job_backups에서 복구 대상의 정확한 id와 payload를 확인한다.
3. GET /api/state의 최신 revision을 확인한다.
4. 같은 사이트 출처에서 인증된 POST /api/state로 아래 요청을 보낸다.
   action: restore-backup
   revision: 현재 revision
   backupId: 확인한 정확한 백업 ID
   confirm: RESTORE
5. 서버는 대상 payload 검증 후 현재 상태를 다시 백업하고 applications를 복원한다. revision은 증가시킨다. 충돌이면 409이며 다시 비교한다.
6. 다시 GET하여 공고 수·ID·메모·일정을 비교한다.

복구도 기존 백업을 지우지 않으므로 직전 상태로 재복구할 수 있다. 운영 인증은 Sites가 담당하며 인증 토큰을 코드·문서·Git에 넣지 않는다. 복구 API는 소유자 전용 사이트의 운영 절차이며 별도 복구 UI는 없다.

## 코드 롤백
v2 저장소를 유지하는 이전 안정 버전으로 되돌리는 것이 우선이다. v1 앱으로 되돌리면 v2에서 작성한 내용이 화면에 보이지 않는다. 따라서 v1 재배포 전에 반드시 v2 내보내기를 보관하고 v2 호환 수정 버전 배포를 우선한다.
app_state에 v2를 덮어쓰거나 v1/v2 이중 쓰기를 활성화하지 않는다. 테이블 DROP이나 원본 삭제는 하지 않는다.

## 검증 범위
SQLite 테스트는 마이그레이션·원본 보존·손상 거부·실패 시 rollback·snapshot 복구를 확인한다. 실제 생산 DB 복구 실행은 하지 않는다. 최종 이전 및 배포 결과는 CHECK.md를 참조한다.
