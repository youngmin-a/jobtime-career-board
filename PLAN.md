# 취준캘린더 v2 구현

1. 운영 DB 확인: DB/app_state, 현재 0행. Vinext/Workers/D1 유지.
2. v2 모델, 입력 검증, 원본 기반 캘린더 생성.
3. v1 테이블 보존, v2 테이블과 변경 전 스냅샷, CAS 충돌 검사.
4. 수동/공식 공고 CRUD, 전형/개인 일정 편집.
5. 대시보드, 월간/주간/목록, 필터, 상세 패널.
6. 도메인/저장 실패/마이그레이션 테스트, 타입/lint/build, 로컬 통합 검증.
7. workspace_state/workspace_backups 추가와 익명 브라우저·계정 작업공간 분리.
8. 이름 기반 named_spaces/name_sessions/name_imports 추가, 기존 브라우저 기록 선택적 가져오기.
9. 2026년 하반기·마감 포함 공개 검색, 페이지 추가 조회, 공식 원문 재검증.
10. 문서 정합성, 커밋, 공개 Worker 배포 및 운영 읽기 검증.
