# JOBTIME

내 지원 공고, 전형 진행, 취업 일정을 관리하는 개인 앱입니다.

- 공식 공고 검색: KB국민은행·IBK기업은행·NH농협은행
- 모든 기업의 수동 등록, 공고·전형·개인 일정 편집
- 대시보드, 월간·주간·목록 캘린더, KST 날짜와 미공개 시각 구분
- Vinext / React / Cloudflare Workers / D1 단일 저장소

개발: npm run dev → http://localhost:3000
검증: npm run test, npm run typecheck, npm run lint, npm run build

PRD.md는 제품 정의, DESIGN.md는 실제 설계, MIGRATION.md는 백업·복구, CHECK.md는 검증 결과입니다.
운영 사이트는 .openai/hosting.json의 기존 Sites 프로젝트를 사용합니다. 로컬 .wrangler 데이터는 운영 D1과 별도입니다.
