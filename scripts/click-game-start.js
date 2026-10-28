#!/usr/bin/env node
/**
 * countthefingers.com을 열고 "게임시작" 버튼을 클릭합니다.
 * 실행: node scripts/click-game-start.js  또는  npm run click:start
 */
import { chromium } from 'playwright';

const BASE_URL = 'https://countthefingers.com';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('페이지 로드 중:', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // 게임시작/시작하기/플레이 버튼 또는 링크 찾기 (여러 패턴)
  const selectors = [
    page.getByRole('button', { name: /게임\s*시작|시작하기|시작|플레이|게임\s*시작하기/i }),
    page.getByRole('link', { name: /게임\s*시작|시작하기|시작|플레이/i }),
    page.locator('button:has-text("게임시작"), button:has-text("게임 시작"), a:has-text("게임시작"), a:has-text("게임 시작")'),
    page.getByText('게임시작', { exact: true }),
    page.getByText('게임 시작'),
    page.getByText('시작하기'),
  ];

  let clicked = false;
  for (const selector of selectors) {
    const count = await selector.count();
    if (count > 0) {
      const first = selector.first();
      await first.scrollIntoViewIfNeeded();
      await first.click();
      console.log('클릭함: 게임시작 버튼');
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    console.log('게임시작 버튼을 찾지 못했습니다. 5초 후 브라우저를 닫습니다.');
    await page.waitForTimeout(3000);
  } else {
    console.log('3초 후 브라우저를 닫습니다. (유지하려면 Ctrl+C)');
    await page.waitForTimeout(3000);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
