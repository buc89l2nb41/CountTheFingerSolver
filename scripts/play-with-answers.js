#!/usr/bin/env node
/**
 * countthefingers.com 게임을 반복 플레이합니다.
 * - 퀴즈 ID는 fetch 가로채기로 획득
 * - ./answer/[문제번호].txt 있으면: REAL → REAL 버튼, AI → FAKE 버튼
 * - 없으면 REAL로 추측 후, 결과(정답은 REAL/FAKE)를 [문제번호].txt에 저장 (REAL 또는 AI)
 *
 * 실행: node scripts/play-with-answers.js  또는  npm run play:answers
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://countthefingers.com';
const ANSWER_DIR = join(process.cwd(), 'answer');
const MAX_ROUNDS = process.env.MAX_ROUNDS ? parseInt(process.env.MAX_ROUNDS, 10) : Infinity;

/** 대기 시간(ms) - 필요 시 수정 */
const DELAY_AFTER_GAME_START_CLICK = 600;   // 게임시작 클릭 후
const DELAY_AFTER_ALL_SHOW_CLICK = 150;     // 모두 표시 클릭 후
const DELAY_AFTER_START_CLICK = 1000;       // START 클릭 후
const QUIZ_ID_POLL_INTERVAL = 300;          // 퀴즈 ID 폴링 간격
const QUIZ_ID_POLL_ATTEMPTS = 30;           // 퀴즈 ID 폴링 최대 횟수
const DELAY_BEFORE_BUTTON_CLICK = 150;      // 퀴즈 표시 후 → REAL/FAKE 클릭 전
const DELAY_AFTER_BUTTON_CLICK = 500;      // REAL/FAKE 클릭 후 → 결과 표시 대기
const DELAY_BEFORE_CLOSE = 2000;            // 종료 시 브라우저 닫기 전

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

function getAnswer(quizId) {
  const p = join(ANSWER_DIR, `${quizId}.txt`);
  if (!existsSync(p)) return null;
  const s = readFileSync(p, 'utf-8').trim().toUpperCase();
  return s === 'REAL' || s === 'AI' ? s : null;
}

function saveAnswer(quizId, realOrAi) {
  mkdirSync(ANSWER_DIR, { recursive: true });
  const text = realOrAi === 'REAL' ? 'REAL' : 'AI';
  writeFileSync(join(ANSWER_DIR, `${quizId}.txt`), text, 'utf-8');
  console.log(`  저장: answer/${quizId}.txt → ${text}`);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(FETCH_PATCH);
  console.log('페이지 로드:', BASE_URL);
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

  const realBtn = page.getByRole('button', { name: 'REAL' });
  const fakeBtn = page.getByRole('button', { name: 'FAKE' });
  let round = 0;

  for (let i = 0; i < QUIZ_ID_POLL_ATTEMPTS; i++) {
    const id = await page.evaluate(() => window.__LAST_QUIZ__ && (window.__LAST_QUIZ__.data?.id ?? window.__LAST_QUIZ__.id));
    if (id != null) break;
    await page.waitForTimeout(QUIZ_ID_POLL_INTERVAL);
  }

  console.log('라운드 무제한 (종료: NEXT 없음 또는 Ctrl+C)\n');

  while (round < MAX_ROUNDS) {
    await page.waitForTimeout(DELAY_BEFORE_BUTTON_CLICK);

    const quizId = await page.evaluate(() => {
      const d = window.__LAST_QUIZ__;
      if (!d) return null;
      const id = (d.data && (d.data.id || d.data.quizId)) || d.id;
      return id != null ? String(id) : null;
    });

    if (!quizId) {
      console.log(`[${round + 1}] 퀴즈 ID 없음, REAL 추측`);
      await realBtn.click();
    } else {
      const answer = getAnswer(quizId);
      if (answer === 'REAL') {
        console.log(`[${round + 1}] #${quizId} → REAL (파일)`);
        await realBtn.click();
      } else if (answer === 'AI') {
        console.log(`[${round + 1}] #${quizId} → FAKE (파일)`);
        await fakeBtn.click();
      } else {
        console.log(`[${round + 1}] #${quizId} → 추측(REAL)`);
        await realBtn.click();
      }
    }

    await page.waitForTimeout(DELAY_AFTER_BUTTON_CLICK);

    const resultEl = page.getByText(/정답은\s*(REAL|FAKE)/);
    const resultText = (await resultEl.first().textContent().catch(() => '')) || '';
    const isReal = /정답은\s*REAL/i.test(resultText);
    const isFake = /정답은\s*FAKE/i.test(resultText);

    if (quizId && (isReal || isFake)) {
      const saved = getAnswer(quizId);
      if (!saved) {
        saveAnswer(quizId, isReal ? 'REAL' : 'AI');
      }
    }

    const nextBtn = page.getByRole('button', { name: 'NEXT' }).first();
    if (await nextBtn.count() === 0) {
      console.log('NEXT 버튼 없음 (게임 종료?)');
      break;
    }
    await nextBtn.click();
    round++;
  }

  console.log(`\n완료: ${round}라운드`);
  await page.waitForTimeout(DELAY_BEFORE_CLOSE);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
