# Count The Fingers Solver

오라클·플레이세션 구조로 countthefingers.com 퀴즈를 자동 풀이합니다.

## 아키텍처

```
[오라클] getRandomQuiz() → 퀴즈 수신
    │
    ├── quizId + mediaUrl 전달 ──→ [플레이세션]
    │                                  │
    │                                  └── 정답 판별 (REAL/AI)
    │
    └── submitAttempt() ← 정답 수신
```

## 실행

PowerShell 실행 정책 오류 시 **node 직접 실행** 또는 **run.bat** 사용:

```bash
node index.js
# 또는
run.bat
```

> API 제한으로 `getRandomQuiz`로 받은 퀴즈만 제출 가능합니다.  
> 실행 시 랜덤 퀴즈 1개를 받아 REAL로 제출 후 결과를 출력합니다.

**빠른 테스트** (3라운드, 0.5초 대기):
```bash
npm run quick
```

**브라우저 자동 플레이** (answer 파일 있으면 사용, 없으면 추측 후 정답 저장):
```bash
node scripts/play-with-answers.js
# 또는 (PowerShell 실행 정책 오류 시)
play-answers.bat
```
- **라운드**: 기본 **무제한** (NEXT 없을 때까지). 제한하려면 `$env:MAX_ROUNDS=100; node scripts/play-with-answers.js` (PowerShell)
- **속도**: 퀴즈당·결과 대기 시간을 짧게 두어 빠르게 진행

### 인수 / 환경 변수

| 설정 | 기본값 | 설명 |
|------|--------|------|
| 인수 1 | 10 | 라운드 수 |
| 인수 2 | 2000 | 대기 시간(ms) |

```bash
# 인수 사용 (모든 OS)
node index.js 5 1000

# 환경 변수 (Mac/Linux)
ROUNDS=20 DELAY_MS=1000 node index.js

# Windows PowerShell
$env:ROUNDS=20; $env:DELAY_MS=1000; node index.js
```

**요구사항**: Node.js 18+

**정답 수집 (collect-answers.js)**  
- **play-with-answers.js 와 동일하게 브라우저로만 동작** (API 미사용, 서버 차단 시에도 동작)  
- 실행: `node collect-answers.js` (PowerShell 실행 정책 오류 시 `node` 직접 사용)  
- CONCURRENCY 개의 창에서 동시에 게임시작 → 모두 표시 → START 후 수집, TARGET 개수 도달 시 종료  
- `$env:TARGET=2000; $env:CONCURRENCY=5; node collect-answers.js` (PowerShell)

### 웹 자동 테스트 (Playwright)

countthefingers.com 페이지 로드·요소 존재 여부를 자동으로 검사합니다.

```bash
npm install
npx playwright install chromium   # 최초 1회: 브라우저 설치
npm test
```

- **헤드리스**: `npm test` (기본)
- **브라우저 보면서 실행**: `npm run test:headed`
- **UI 모드**: `npm run test:ui`

테스트 파일: `tests/countthefingers.spec.js`

### Chrome DevTools로 테스트

**방법 1: Playwright + DevTools** (Chromium 창에 DevTools가 함께 열림)

```bash
npm run test:devtools
```

테스트가 실행되면서 Chromium 창과 DevTools 패널이 함께 열립니다. Elements, Console, Network 등을 보면서 동작을 확인할 수 있습니다.

**방법 2: 로컬 Chrome + 원격 디버깅** (설치된 Chrome으로 countthefingers.com 열기)

```bash
npm run open:devtools
```

Chrome이 원격 디버깅 모드(포트 9222)로 실행되며 countthefingers.com이 열립니다. 해당 창에서 **F12**로 DevTools를 사용하세요.

- 다른 URL로 열기: `$env:DEVTOOLS_URL="http://localhost:3000"; npm run open:devtools` (PowerShell)
- 포트 변경: `$env:DEBUG_PORT="9333"; npm run open:devtools`

**방법 3: 직접 브라우저에서**

1. Chrome에서 https://countthefingers.com 접속
2. **F12** 또는 우클릭 → 검사 로 DevTools 열기
3. **Network**: API 요청(/api/game-sessions, /api/quizzes/random 등) 확인
4. **Console**: 에러·로그 확인
5. **Elements**: `#root` 및 React 렌더링 구조 확인

### AI가 브라우저로 직접 테스트하는 환경

Cursor에서 **cursor-ide-browser** MCP가 켜져 있으면, AI가 웹 페이지를 직접 열고 클릭·입력까지 해서 동작을 검증할 수 있다.

1. **규칙**: `.cursor/rules/web-test.mdc` — "웹 테스트 해줘" 등 요청 시 MCP 브라우저를 쓰고, `navigate → lock → snapshot → 클릭/입력 → unlock` 순서를 따르도록 안내한다.
2. **시나리오**: `tests/browser-test-scenarios.md` — 메인 로드, 루트 표시, 게임 시작·REAL/AI 선택 등 체크리스트.
3. **로컬 테스트**: `npm run serve` 로 `http://localhost:3000` 에서 `page.html` 등을 띄운 뒤, "localhost:3000 열어서 테스트해줘"라고 요청하면 된다. 운영 사이트는 `https://countthefingers.com` 으로 테스트 가능.

**사용 예**: 채팅에서 "countthefingers.com 열어서 웹 테스트 해줘" 또는 "localhost:3000 페이지 열어서 동작 확인해줘"라고 하면, AI가 브라우저를 열고 시나리오대로 검증한 뒤 결과를 요약해 준다.

MCP 브라우저 연결 방법은 **[docs/MCP-BROWSER-SETUP.md](docs/MCP-BROWSER-SETUP.md)** 를 참고하세요.

## 커스텀 정답 판별기

`src/play-session.js`에서 `createPlaySession()`에 판별 함수를 넘기세요:

```javascript
// index.js 예시
const playSession = createPlaySession(async (quiz) => {
  const { id, mediaUrl, mediaType } = quiz;
  // 미디어 로드 후 AI 분류
  const buffer = await loadMedia(mediaUrl);
  const result = await yourAiClassifier.classify(buffer, mediaType);
  return result; // 'REAL' | 'AI'
});
```

## 프로젝트 구조

```
src/
  api.js        # API 클라이언트
  oracle.js     # 오라클 (세션, 퀴즈, 제출)
  play-session.js  # 플레이세션 (정답 판별)
index.js        # 메인 실행
```

## 참고

- 현재 플레이세션의 기본 판별기는 **랜덤** (동작 확인용)
- 실제 사용 시 AI 비전 모델 등으로 교체 필요
