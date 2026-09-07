# 나의 바이브코딩 시작 프로젝트

Codex를 중심으로 사용하면서 Day 1~3 교재의 Next.js·PDCA 흐름을 따라가는 작업 폴더입니다.

## 바로 시작
이 폴더를 Codex의 작업 프로젝트로 선택합니다. 아래 문장을 복사해 요청하세요.

> AGENTS.md와 PRD.md를 읽어줘. 내가 만들고 싶은 앱은 [아이디어]야. 꼭 필요한 질문만 하고, PRD·PLAN·DESIGN을 정리한 뒤 작은 기능부터 구현하고 검증해줘.

명령을 직접 외울 필요 없이 “개발 서버를 켜고 화면을 보여줘”라고 요청해도 됩니다.
직접 실행하려면 start-dev.cmd를 더블클릭하고 http://localhost:3000 을 엽니다. 서버를 끌 때는 열린 창에서 Ctrl+C를 누릅니다.
포트가 사용 중이면 터미널에 표시된 주소를 사용합니다.

## 파일 안내
| 파일 | 역할 |
|---|---|
| AGENTS.md | Codex가 읽는 작업 규칙과 검증 루프 |
| CLAUDE.md | Claude Code용 동일한 프로젝트 규칙 |
| PRD.md | 무엇을 왜 만드는지 적는 기획서 양식 |
| PLAN.md / DESIGN.md | 작업 순서와 구현 설계 |
| CHECK.md | 실제 검증 결과 |
| src/app/page.tsx | 처음 보이는 화면 |
| public/ | 이미지·로고 자리 |
| .env / .env.example | 비밀값 입력 파일 / 공유 가능한 빈 양식 |
| start-dev.cmd / check.cmd | 미리보기 실행 / 코드 검사 |

## 교재와의 연결
- Day 1: Git·Node.js·Next.js·public·.env 준비. 프로필 및 RAG 챗봇은 이후 실습 내용이다.
- Day 2: 기획 양식과 AGENTS.md/CLAUDE.md의 규칙·검증 루프.
- Day 3: PLAN → DESIGN → 구현 → CHECK → 개선. 실제 앱 기획과 배포는 이후 진행한다.
- Codex에서 bkit 슬래시 명령을 실행하는 대신 “기획해줘”, “설계와 코드를 비교해줘”, “발견한 문제를 고치고 검증해줘”라고 요청한다.
- Claude Code는 open-claude.cmd로 실행한다. 첫 로그인은 사용자가 직접 해야 한다. bkit은 Claude Code 플러그인이다.

## 필요한 경우에만 계정 연결
지금 시작 화면에는 API 키가 필요 없다. GitHub는 코드 업로드, Vercel은 배포, Supabase는 DB·로그인, OpenAI API는 앱의 AI 기능을 만들 때 연결한다.
필요한 키는 .env의 해당 빈 값에 직접 입력하며 채팅이나 메신저로 전송하지 않는다. 실제 키가 있는 파일은 커밋하지 않는다.
관리 토큰(GITHUB_TOKEN, VERCEL_TOKEN, SUPABASE_ACCESS_TOKEN)은 웹앱 배포 환경 변수로 올리지 않는다.
계정 가입·인증·유료 구독·결제는 이번 세팅에서 수행하지 않았다.

## 개발 명령
```powershell
npm.cmd run dev
npm.cmd run check
```
의존성 재설치는 npm.cmd ci를 사용한다. PowerShell 실행 정책 변경 없이 npm.cmd를 사용하면 된다.

## 공식 참고
- [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation)
- [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Claude Code 설치](https://code.claude.com/docs/en/setup)
- [bkit 저장소](https://github.com/ww-w-ai/bkit-claude-code)
