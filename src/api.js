/**
 * countthefingers.com API 클라이언트
 */
const BASE_URL = 'https://countthefingers.com';
const REQUEST_TIMEOUT_MS = 20000;

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': BASE_URL,
        ...options.headers,
      },
      ...options,
    });

    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      throw new Error(data?.message || `API 오류: ${res.status}`);
    }

    return data.data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`요청 시간 초과 (${REQUEST_TIMEOUT_MS / 1000}초)`);
    }
    throw err;
  }
}

export const api = {
  /** 게임 세션 생성 */
  createSession: () =>
    request('/api/game-sessions', { method: 'POST' }),

  /** 랜덤 퀴즈 가져오기 */
  getRandomQuiz: (sessionToken, options = {}) => {
    const params = new URLSearchParams({
      sessionToken,
      excludeMature: String(options.excludeMature ?? true),
      streamerMode: String(options.streamerMode ?? false),
    });
    if (options.streamerSessionId) {
      params.set('streamerSessionId', options.streamerSessionId);
    }
    return request(`/api/quizzes/random?${params}`);
  },

  /** 정답 제출 */
  submitAttempt: (quizId, { sessionToken, selectedAnswer }) =>
    request(`/api/quizzes/${quizId}/attempts`, {
      method: 'POST',
      body: JSON.stringify({ sessionToken, selectedAnswer }),
    }),

  /** 퀴즈 스킵 */
  skipQuiz: (quizId, sessionToken, streamerMode = false, streamerSessionId = null) =>
    request(`/api/quizzes/${quizId}/skip`, {
      method: 'POST',
      body: JSON.stringify({
        sessionToken,
        streamerMode,
        streamerSessionId,
      }),
    }),
};
