# 취준캘린더
내 지원 공고, 전형 진행, 취업 일정을 관리하는 개인 앱입니다.
- 공식 공고 검색: KB국민은행·IBK기업은행·NH농협은행·우리은행 공식 원문
- 모든 기업의 수동 등록, 공고·전형·개인 일정 편집
- 대시보드, 월간·주간·목록 캘린더, KST 날짜와 미공개 시각 구분
- Vinext / React / Cloudflare Workers / D1 단일 저장소
개발: npm run dev → http://localhost:3000
검증: npm run test, npm run typecheck, npm run lint, npm run build
PRD.md는 제품 정의, DESIGN.md는 실제 설계, MIGRATION.md는 백업·복구, CHECK.md는 검증 결과입니다.
기존 Sites와 Cloudflare Worker는 같은 코드베이스를 사용합니다. 방문자는 이름 또는 별명만 입력해 D1 이름 공간을 열고, 같은 이름으로 재접속할 수 있습니다. 세션 쿠키와 서버 세션 태그가 작업공간 범위를 확인하며, 기존 브라우저 기록은 사용자가 선택할 때만 백업 후 가져옵니다. 로컬 `.wrangler` 데이터는 운영 D1과 별도입니다.
## GitHub + Cloudflare Workers 배포
.github/workflows/deploy-cloudflare.yml이 main push마다 typecheck·lint·test·build를 수행한 뒤 Cloudflare D1 마이그레이션과 Worker 배포를 실행합니다. GitHub 저장소와 Cloudflare 계정 연결이 완료되면 다음 Actions secrets가 필요합니다.
- CLOUDFLARE_API_TOKEN: Workers 및 D1 배포 권한을 가진 토큰
- CLOUDFLARE_ACCOUNT_ID: 배포할 Cloudflare 계정 ID
- CLOUDFLARE_D1_DATABASE_ID: 새 Cloudflare D1의 ID
배포 대상 D1은 `DB` 바인딩 하나를 운영 영속 저장소로 사용하며 `migrations/`의 추가형 마이그레이션을 순서대로 적용합니다. `app_state`·`job_state_v2`·`workspace_state`·`workspace_backups`는 보존하고, 이름 진입용 `named_spaces`·`name_sessions`·`name_imports`만 0003에서 추가합니다. 개인 데이터는 공개 URL의 방문자끼리 공유하지 않으며, 기존 브라우저 기록은 명시적 가져오기 전에는 복사하지 않습니다.
