#!/usr/bin/env node
/**
 * play-with-answers.js 와 동일하게 브라우저로만 동작 (API 미사용).
 * 서버 차단 시에도 브라우저 클릭으로 정상 수집.
 *
 * - CONCURRENCY 개의 브라우저 창에서 동시에 게임시작 → 모두 표시 → START 후
 * - 식별: mediaUrl만 사용 (URL 해시 = 같은 영상/이미지 = 같은 키). 퀴즈 번호 미사용.
 * - answer/[키].txt 있으면 REAL/FAKE 클릭, 없으면 추측 후 정답 저장
 * - TARGET 설정 시: 새로 저장한 개수가 TARGET 에 도달하면 종료
 * - TARGET 미설정(또는 0): 개수 제한 없이 계속 수집 (Ctrl+C로 종료)
 *
 * 사용법: node collect-answers.js
 *   node collect-answers.js                    # 제한 없이 수집
 *   $env:TARGET=2000; $env:CONCURRENCY=5; node collect-answers.js  (PowerShell)
 *   $env:RESTART=1; node collect-answers.js    # NEXT 없을 때 "다시하기" 클릭 후 계속
 */
const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeVersion < 18) {
  console.error('Node.js 18 이상이 필요합니다.');
  process.exit(1);
}

import { createHash } from 'crypto';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * mediaUrl에서 콘텐츠 해시만 추출 (경로의 마지막 세그먼트).
 * 도메인/앞쪽 경로는 상관없음 (예: cloudfront 주소가 달라도 .../optimized/ 뒤 값만 사용).
 * 추출 실패 시에만 전체 URL을 SHA-256 해시한 값을 씀.
 */
function toAnswerKey(quiz) {
  if (!quiz) return null;
  const mediaUrl = quiz.mediaUrl ?? quiz.data?.mediaUrl ?? quiz.media?.url;
  if (!mediaUrl || typeof mediaUrl !== 'string') return null;

  try {
    const pathname = new URL(mediaUrl).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1]; // 앞 주소 무관, 항상 마지막 부분만 사용
    // 확장자 제거(.mp4 등) 후 파일명으로 쓸 수 있는지 확인
    const raw = last && /^[\w\-]+(\.[a-z0-9]+)?$/i.test(last)
      ? last.replace(/\.[a-z0-9]+$/i, '')
      : last;
    if (raw && raw.length > 0 && raw.length <= 64) return raw;
  } catch (_) {}

  return createHash('sha256').update(mediaUrl).digest('hex').slice(0, 32);
}

const BASE_URL = 'https://countthefingers.com';
const ANSWER_DIR = join(process.cwd(), 'answer');
const TARGET_RAW = process.env.TARGET;
const TARGET = TARGET_RAW ? parseInt(TARGET_RAW, 10) : null; // null = 제한 없음
const HAS_TARGET = TARGET != null && TARGET > 0;
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10);
const CLICK_RESTART = /^1|true|yes$/i.test(process.env.RESTART || '');

/** 대기 시간(ms) - play-with-answers.js 와 동일, 필요 시 수정 */
const DELAY_AFTER_GAME_START_CLICK = 600;
const DELAY_AFTER_ALL_SHOW_CLICK = 150;
const DELAY_AFTER_START_CLICK = 1000;
const QUIZ_ID_POLL_INTERVAL = 300;
const QUIZ_ID_POLL_ATTEMPTS = 30;
const DELAY_BEFORE_BUTTON_CLICK = 350;
const DELAY_AFTER_BUTTON_CLICK = 500;
const DELAY_AFTER_RESTART_CLICK = 700; // 다시 도전 클릭 후 다음 퀴즈 로드 대기
const BROWSER_HEADLESS = false;

const FETCH_PATCH = `
(function() {
  const orig = window.fetch;
  window.fetch = function(...a) {
    return orig.apply(this, a).then(r => {
      const url = (a[0] && (typeof a[0] === 'string' ? a[0] : a[0].url)) || '';
      if (url.includes('/api/quizzes/random')) {
        return r.clone().json().then(d => { window.__LAST_QUIZ__ = d; return r; }).catch(() => r);
      }
      return r;
    });
  };
})();
`;

function getAnswer(key) {
  if (!key) return null;
  const p = join(ANSWER_DIR, `${key}.txt`);
  if (!existsSync(p)) return null;
  const s = readFileSync(p, 'utf-8').trim().toUpperCase();
  return s === 'REAL' || s === 'AI' ? s : null;
}

function saveAnswer(key, realOrAi) {
  if (!key) return;
  mkdirSync(ANSWER_DIR, { recursive: true });
  const text = realOrAi === 'REAL' ? 'REAL' : 'AI';
  writeFileSync(join(ANSWER_DIR, `${key}.txt`), text, 'utf-8');
}

async function main() {
  const collected = { count: 0 };
  let addLock = Promise.resolve();

  const addIfNew = (key, realOrAi, isCorrect, logLabel) =>
    (addLock = addLock.then(() => {
      if (HAS_TARGET && collected.count >= TARGET) return false;
      if (getAnswer(key) !== null) return false;
      saveAnswer(key, realOrAi);
      collected.count++;
      const icon = isCorrect ? '✓' : '✗';
      const countLabel = HAS_TARGET ? `[${collected.count}/${TARGET}]` : `[${collected.count}]`;
      const pctSuffix = HAS_TARGET ? ` (${((collected.count / TARGET) * 100).toFixed(1)}%)` : '';
      console.log(`${countLabel} ${icon} ${logLabel} → ${realOrAi}${pctSuffix}`);
      return true;
    }));

  const targetLabel = HAS_TARGET ? `${TARGET}개` : '제한 없음';
  console.log(`=== 정답 수집 (브라우저 방식, 목표: ${targetLabel}, 동시 ${CONCURRENCY}창${CLICK_RESTART ? ', 다시하기 사용' : ''}) ===\n`);

  const browser = await chromium.launch({ headless: BROWSER_HEADLESS });

  const runWorker = async (workerId) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(FETCH_PATCH);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const startBtn = page.getByRole('button', { name: /게임\s*시작/i }).first();
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForTimeout(DELAY_AFTER_GAME_START_CLICK);
    }

    const allShowBtn = page.getByRole('button', { name: /모두\s*표시/i }).first();
    if (await allShowBtn.count() > 0) {
      await allShowBtn.click();
      await page.waitForTimeout(DELAY_AFTER_ALL_SHOW_CLICK);
    }

    const startGameBtn = page.getByRole('button', { name: 'START' }).first();
    if (await startGameBtn.count() > 0) {
      await startGameBtn.click();
      await page.waitForTimeout(DELAY_AFTER_START_CLICK);
    }

    const getQuizFromPage = () =>
      page.evaluate(() => {
        const d = window.__LAST_QUIZ__;
        if (!d) return null;
        const data = d.data || d;
        return {
          id: data.id ?? data.quizId ?? d.id,
          mediaUrl: data.mediaUrl ?? data.media?.url ?? d.mediaUrl,
        };
      });

    for (let i = 0; i < QUIZ_ID_POLL_ATTEMPTS; i++) {
      const q = await getQuizFromPage();
      if (q?.id != null || q?.mediaUrl) break;
      await page.waitForTimeout(QUIZ_ID_POLL_INTERVAL);
    }

    const realBtn = page.getByRole('button', { name: 'REAL' });
    const fakeBtn = page.getByRole('button', { name: 'FAKE' });

    let lastQuizKey = null;

    while (!HAS_TARGET || collected.count < TARGET) {
      await page.waitForTimeout(DELAY_BEFORE_BUTTON_CLICK);

      // NEXT 클릭 후 새 퀴즈가 __LAST_QUIZ__에 반영될 때까지 대기 (이전 퀴즈 기준으로 정답 조회 방지)
      if (lastQuizKey != null) {
        for (let k = 0; k < 40; k++) {
          const q = await getQuizFromPage();
          const key = q ? toAnswerKey(q) : null;
          if (key !== lastQuizKey) break;
          await page.waitForTimeout(250);
        }
      }

      const quiz = await getQuizFromPage();
      const answerKey = quiz ? toAnswerKey(quiz) : null;
      lastQuizKey = answerKey;
      const logLabel = answerKey ? `url:${answerKey.slice(0, 8)}` : '?';

      // answer/[키].txt 에서 정답 조회 → 있으면 REAL/FAKE, 없으면 추측(REAL)
      const savedAnswer = answerKey ? getAnswer(answerKey) : null;
      const whichBtn = savedAnswer === 'AI' ? fakeBtn.first() : realBtn.first();
      let didClick = false;
      try {
        await whichBtn.waitFor({ state: 'visible', timeout: 3000 });
        await whichBtn.click({ timeout: 8000 });
        didClick = true;
      } catch (_) {
        // 버튼이 비활성(결과 화면 등)이면 클릭 건너뛰고 아래에서 NEXT/다시도전 처리
      }

      await page.waitForTimeout(DELAY_AFTER_BUTTON_CLICK);

      if (didClick) {
        const resultEl = page.getByText(/정답은\s*(REAL|FAKE)/);
        const resultText = (await resultEl.first().textContent().catch(() => '')) || '';
        const isReal = /정답은\s*REAL/i.test(resultText);
        const isFake = /정답은\s*FAKE/i.test(resultText);

        if (answerKey && (isReal || isFake)) {
          const realOrAi = isReal ? 'REAL' : 'AI';
          const saved = getAnswer(answerKey);
          if (!saved) {
            await addIfNew(answerKey, realOrAi, realOrAi === 'REAL', logLabel);
          } else if (saved !== realOrAi) {
            addLock = addLock.then(() => {
              saveAnswer(answerKey, realOrAi);
              console.log(`수정 ${logLabel} ✗ ${saved} → ${realOrAi}`);
            });
            await addLock;
          }
        }
      }

      if (HAS_TARGET && collected.count >= TARGET) break;

      const nextBtn = page.getByRole('button', { name: 'NEXT' }).first();
      const restartBtn = page.locator('button[aria-label="다시 도전"]').first();

      // 게임오버면 "다시 도전"이 보임. 먼저 재시작 버튼 확인
      const restartVisible = await restartBtn.isVisible().catch(() => false);
      if (restartVisible && CLICK_RESTART) {
        await restartBtn.scrollIntoViewIfNeeded();
        await restartBtn.click({ force: true });
        await page.waitForTimeout(DELAY_AFTER_RESTART_CLICK);
        continue;
      }

      if (await nextBtn.count() === 0) {
        if (CLICK_RESTART) {
          await page.waitForTimeout(800);
          try {
            await restartBtn.waitFor({ state: 'visible', timeout: 8000 });
            await restartBtn.scrollIntoViewIfNeeded();
            await restartBtn.click({ force: true });
            await page.waitForTimeout(DELAY_AFTER_RESTART_CLICK);
            continue;
          } catch (_) {
            const byText = page.locator('button').filter({ hasText: '다시하기' }).first();
            try {
              await byText.waitFor({ state: 'visible', timeout: 5000 });
              await byText.click({ force: true });
              await page.waitForTimeout(DELAY_AFTER_RESTART_CLICK);
              continue;
            } catch (__) {}
          }
        }
        break;
      }
      await nextBtn.click();
    }
  };

  try {
    const workers = Array.from({ length: CONCURRENCY }, (_, i) => runWorker(i));
    await Promise.all(workers);

    console.log(`\n=== 완료 ===`);
    console.log(`수집: ${collected.count}개`);
    console.log(`저장: ${ANSWER_DIR}/[mediaUrl해시].txt`);
  } catch (err) {
    console.error('오류:', err.message);
    if (collected.count > 0) {
      console.log(`중간 저장: ${collected.count}개 → ${ANSWER_DIR}/`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
