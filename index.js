#!/usr/bin/env node
/**
 * Count The Fingers Solver
 *
 * 사용법: node index.js
 *   - 랜덤 퀴즈 1개를 받아 REAL 제출 후 결과 출력
 *
 * (API 제한: getRandomQuiz로 받은 퀴즈만 제출 가능)
 */
const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeVersion < 18) {
  console.error('Node.js 18 이상이 필요합니다. 현재:', process.version);
  process.exit(1);
}

import { api } from './src/api.js';

async function main() {
  console.log('퀴즈 받는 중...\n');

  try {
    const sessionToken = await api.createSession();
    const quiz = await api.getRandomQuiz(sessionToken, {
      excludeMature: true,
      streamerMode: false,
    });

    if (!quiz?.id) {
      throw new Error('퀴즈를 불러올 수 없습니다.');
    }

    const quizId = quiz.id;
    console.log(`문제 ${quizId}에 REAL 제출 중...\n`);

    const result = await api.submitAttempt(String(quizId), {
      sessionToken,
      selectedAnswer: 'REAL',
    });

    const icon = result?.isCorrect ? '✓ 정답' : '✗ 오답';
    console.log('--- 결과 ---');
    console.log(`문제 번호: ${quizId}`);
    console.log(`선택: REAL`);
    console.log(`결과: ${icon}`);
    console.log(`정답 여부: ${result?.isCorrect ?? false}`);
    if (result?.isCleared) console.log('게임 클리어!');
    console.log('------------');

    process.exitCode = result?.isCorrect ? 0 : 1;
  } catch (err) {
    console.error('오류:', err.message);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
