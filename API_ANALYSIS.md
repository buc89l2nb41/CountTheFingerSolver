# countthefingers.com API 분석 결과

## 정답 판별 POST API

### 엔드포인트
```
POST https://countthefingers.com/api/quizzes/{quizId}/attempts
```

### 요청 (Request)

**Headers:**
```
Content-Type: application/json
```
- `credentials: "include"` (쿠키 포함)

**Body (JSON):**
```json
{
  "sessionToken": "string",      // 필수 - 게임 세션 토큰
  "selectedAnswer": "REAL"       // 또는 "AI" - 사용자가 선택한 답
}
```

### 응답 (Response)

**성공 시 (200 OK):**
```json
{
  "success": true,
  "data": {
    "isCorrect": true,           // 정답 여부
    "isCleared": false           // 게임 클리어 여부
  }
}
```

---

## 관련 API 플로우

### 1. 게임 세션 생성
```
POST /api/game-sessions
```
- 세션 토큰 획득 (submitAttempt에 필요)

### 2. 랜덤 퀴즈 가져오기
```
GET /api/quizzes/random?sessionToken={token}&excludeMature={bool}&streamerMode={bool}
```
- `quizId` 획득 (attempts API의 {quizId}에 사용)

### 3. 정답 제출 ← **핵심 API**
```
POST /api/quizzes/{quizId}/attempts
Body: { sessionToken, selectedAnswer }
```

---

## 답안 값 (selectedAnswer)

| 값 | 의미 |
|----|------|
| `REAL` | 실제 이미지/영상 |
| `AI` | AI 생성 이미지/영상 |

---

## 발견된 전체 API 목록

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/api/game-sessions` | 세션 생성 |
| GET | `/api/game-sessions/summary` | 세션 요약 |
| GET | `/api/quizzes/random` | 랜덤 퀴즈 |
| **POST** | **`/api/quizzes/{id}/attempts`** | **정답 제출** |
| POST | `/api/quizzes/{id}/skip` | 퀴즈 스킵 |
| POST | `/api/quizzes/{id}/timeout` | 타임아웃 처리 |
| POST | `/api/quizzes/load-failures` | 로드 실패 신고 |

---

*분석일: 2025-02-01*
*출처: countthefingers.com 클라이언트 JS (index-C46wp906.js)*
