/**
 * Count The Fingers 웹 자동 테스트
 * 실행: npm test  또는  npx playwright test
 */
import { test, expect } from '@playwright/test';

test.describe('Count The Fingers', () => {
  test('메인 페이지 로드', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Count The Fingers|AI 맞추기|AI 구분하기/);
  });

  test('페이지에 루트 요소 존재', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('#root');
    await expect(root).toBeVisible({ timeout: 10000 });
  });

  test('게임 시작 가능 여부 (시작 버튼/링크 등)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // 시작/플레이 관련 버튼이나 링크가 있으면 클릭 가능 여부 확인
    const startButton = page.getByRole('button', { name: /시작|시작하기|플레이|게임/ }).or(
      page.getByRole('link', { name: /시작|플레이|게임/ })
    ).first();
    const count = await startButton.count();
    if (count > 0) {
      await expect(startButton.first()).toBeVisible();
    }
  });
});
