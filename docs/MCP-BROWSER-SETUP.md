# MCP 브라우저 연결 방법 (Cursor)

Cursor에서 AI가 웹 페이지를 직접 열고 클릭·입력할 수 있게 하려면 **브라우저 자동화**를 켜거나 **브라우저용 MCP 서버**를 연결하면 됩니다.

---

## 방법 1: Cursor 내장 Browser (권장)

Cursor에는 **별도 설치 없이** 사용할 수 있는 브라우저 기능이 있습니다.

### 1. 설정에서 활성화

1. **Cursor** 메뉴 → **Settings** (또는 `Ctrl + ,` / `Cmd + ,`)
2. **Tools & MCP** → **Browser Automation** (또는 **Features** → **MCP** / **Browser**)
3. **Browser** 사용 가능 여부 확인  
   - "Browser Automation" 또는 "Browser" 토글이 있으면 **켜기**
4. **브라우저 모드 선택** (있는 경우):
   - **Chrome**: 별도 Chrome 창으로 실행
   - **Browser Tab**: Cursor 안의 탭으로 실행

### 2. 채팅에서 사용

- 채팅 시 **Available Tools** 목록에 브라우저 관련 도구가 보이면 연결된 상태입니다.
- "countthefingers.com 열어서 게임시작 버튼 눌러줘"처럼 요청하면 AI가 브라우저를 열고 동작합니다.
- 기본값은 **도구 사용 전 승인**입니다. **Cursor Settings** → **Chat** → **Auto-Run**에서 자동 실행을 켤 수 있습니다.

> 참고: [Cursor 공식 문서 - Browser](https://cursor.com/docs/agent/browser)

---

## 방법 2: MCP 서버로 브라우저 추가 (mcp.json)

내장 Browser가 없거나, 다른 브라우저 MCP를 쓰고 싶다면 **MCP 설정 파일**에 서버를 추가합니다.

### 설정 위치

- **프로젝트만**: 프로젝트 루트에 `.cursor/mcp.json`
- **전역**: 홈 디렉터리에 `~/.cursor/mcp.json` (Windows: `%USERPROFILE%\.cursor\mcp.json`)

### 예시: Browser MCP (npx로 실행)

`.cursor/mcp.json` (프로젝트 루트에 생성):

```json
{
  "mcpServers": {
    "browsermcp": {
      "command": "npx",
      "args": ["-y", "@browsermcp/mcp@latest"]
    }
  }
}
```

### 예시: Playwright MCP (E2E 테스트용)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

### 적용 방법

1. `.cursor/mcp.json` 파일 저장
2. Cursor에서 **MCP 목록 새로고침** (설정의 MCP 섹션에 새로고침 버튼이 있는 경우 사용)
3. 채팅을 다시 열고 **Available Tools**에 해당 서버 도구가 나오는지 확인

### 사전 요구사항

- **Node.js 18+** 설치
- 터미널에서 `npx` 사용 가능 (최초 실행 시 패키지 다운로드)

---

## 방법 3: Cursor MCP 디렉터리에서 추가

1. **Cursor** → **Settings** → **MCP** (또는 **Features** → **MCP**)
2. **Browse MCP Tools** / **MCP Directory** 로 이동  
   - [Cursor MCP Directory](https://cursor.com/docs/context/mcp/directory)
3. **Browserbase**, **Chrome DevTools**, **Playwright** 등 원하는 브라우저 관련 서버 선택
4. **Add to Cursor** 로 설치 후, 설정에서 해당 서버가 켜져 있는지 확인

---

## 연결 확인

- 채팅 창에서 **Available Tools** (또는 도구 목록)에  
  `browser_navigate`, `browser_click`, `browser_snapshot` 등이 보이면 **연결된 것**입니다.
- 도구가 안 보이면:
  - Cursor 재시작
  - MCP 설정 파일 문법 확인 (JSON 유효성)
  - Node/npx 경로가 맞는지 확인

---

## 이 프로젝트에서의 사용

- **규칙**: `.cursor/rules/web-test.mdc` — 웹 테스트 요청 시 브라우저 MCP 사용 순서 안내
- **시나리오**: `tests/browser-test-scenarios.md` — 메인 로드, 게임 시작, REAL/AI 선택 등 체크리스트

연결이 되면 "countthefingers.com 열어서 테스트해줘" 또는 "게임시작 버튼 눌러줘"라고 요청해 보세요.
