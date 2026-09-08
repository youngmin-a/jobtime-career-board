# JOBTIME
내 지원 공고, 전형 진행, 취업 일정을 관리하는 개인 앱입니다.
- 공식 공고 검색: KB국민은행·IBK기업은행·NH농협은행
- 모든 기업의 수동 등록, 공고·전형·개인 일정 편집
- 대시보드, 월간·주간·목록 캘린더, KST 날짜와 미공개 시각 구분
- Vinext / React / Cloudflare Workers / D1 단일 저장소
개발: npm run dev → http://localhost:3000
검증: npm run test, npm run typecheck, npm run lint, npm run build
PRD.md는 제품 정의, DESIGN.md는 실제 설계, MIGRATION.md는 백업·복구, CHECK.md는 검증 결과입니다.
운영 사이트는 .openai/hosting.json의 기존 Sites 프로젝트를 사용합니다. 로컬 .wrangler 데이터는 운영 D1과 별도입니다
## GitHub + Cloudflare Workers 배포
.github/workflows/deploy-cloudflare.yml이 main push마다 typecheck·lint·test·build를 수행한 뒤 Cloudflare D1 마이그레이션과 Worker 배포를 실행합니다. GitHub 저장소와 Cloudflare 계정 연결이 완료되면 다음 Actions secrets가 필요합니다.
- CLOUDFLARE_API_TOKEN: Workers 및 D1 배포 권한을 가진 토큰
- CLOUDFLARE_ACCOUNT_ID: 배포할 Cloudflare 계정 ID
- CLOUDFLARE_D1_DATABASE_ID: 새 Cloudflare D1의 ID
Cloudflare D1은 ChatGPT Sites의 기존 D1과 계정·바인딩이 다르므로 자동으로 연결하지 않습니다. 새 D1에는 migrations/가 먼저 적용되고, 기존 개인 데이터는 공개 Worker로 복사하지 않습니다. 개인 데이터 이전이 필요할 때만 백업 파일을 검토한 뒤 명시적으로 import합니다.
