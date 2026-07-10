import { expect, test, type Page } from '@playwright/test';

import type { MusicPlaybackState } from '../src/game/utils/SoundManager';

declare global {
  interface Window {
    __GAME_TEST__?: {
      endGame: (reason?: 'energy' | 'injuryRisk') => void;
      completeGame: () => void;
      getPlayerState: () => string;
      setStage: (stageId: 'base' | 'build' | 'race') => void;
      getMusicState: () => MusicPlaybackState;
    };
    __SHARE_TEST__?: {
      text: string;
      fileCount: number;
      fileType: string;
    };
  }
}

const gameCanvas = (page: Page) => page.getByTestId('game-canvas');

const browserErrors = new WeakMap<Page, string[]>();

async function startGame(page: Page) {
  await page.getByTestId('start-button').click();
  await expect(gameCanvas(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto('/?e2e=1');
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

test('首頁可以載入', async ({ page }) => {
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByRole('heading', { name: '馬拉松完賽訓練' })).toBeVisible();
  await expect(page.getByText('基礎期', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('正式比賽', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('start-button')).toBeEnabled();
});

test('點擊開始後進入遊戲', async ({ page }) => {
  await startGame(page);

  await expect(page.getByTestId('home-screen')).toBeHidden();
  await expect(page.getByTestId('pause-button')).toBeVisible();
});

test('遊戲畫布存在', async ({ page }) => {
  await startGame(page);

  await expect(gameCanvas(page)).toHaveCount(1);
});

test('手機與桌機跳躍按鈕可觸發角色跳躍', async ({ page }) => {
  await startGame(page);
  await page.waitForTimeout(120);

  await page.getByTestId('jump-button').click();
  await page.waitForFunction(() => window.__GAME_TEST__?.getPlayerState() === 'jumping');
});

test('暫停與繼續功能正常', async ({ page }) => {
  await startGame(page);
  await page.waitForTimeout(120);
  await page.getByTestId('jump-button').click();

  const distance = page.locator('[data-distance]');
  await page.waitForTimeout(250);

  await page.getByTestId('pause-button').click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  const pausedDistance = await distance.textContent();
  await page.waitForTimeout(350);
  expect(await distance.textContent()).toBe(pausedDistance);

  await page.getByTestId('resume-button').click();
  await expect(page.getByTestId('pause-overlay')).toBeHidden();
  await expect(page.getByTestId('pause-button')).toBeVisible();
  await page.waitForTimeout(350);
  expect(await distance.textContent()).not.toBe(pausedDistance);
});

test('三階段配樂會切換，並遵守聲音開關與暫停狀態', async ({ page }) => {
  await startGame(page);
  await page.waitForFunction(() => window.__GAME_TEST__?.getMusicState().stageId === 'base');

  await page.evaluate(() => window.__GAME_TEST__?.setStage('build'));
  await page.waitForFunction(() => window.__GAME_TEST__?.getMusicState().stageId === 'build');

  await page.evaluate(() => window.__GAME_TEST__?.setStage('race'));
  await page.waitForFunction(() => window.__GAME_TEST__?.getMusicState().stageId === 'race');

  await page.getByTestId('sound-toggle').click();
  await expect(page.locator('[data-sound-label]')).toHaveText('聲音：關');
  await page.waitForFunction(() => window.__GAME_TEST__?.getMusicState().isPlaying === false);

  await page.getByTestId('sound-toggle').click();
  await expect(page.locator('[data-sound-label]')).toHaveText('聲音：開');
  await page.waitForFunction(() => window.__GAME_TEST__?.getMusicState().stageId === 'race');

  await page.getByTestId('pause-button').click();
  await page.waitForFunction(() => window.__GAME_TEST__?.getMusicState().isPaused === true);
  await page.getByTestId('resume-button').click();
  await page.waitForFunction(() => window.__GAME_TEST__?.getMusicState().isPaused === false);

  await page.evaluate(() => window.__GAME_TEST__?.endGame('energy'));
  await page.waitForFunction(() => window.__GAME_TEST__?.getMusicState().stageId === null);
});

test('鍵盤可啟動首頁按鈕', async ({ page }) => {
  const startButton = page.getByTestId('start-button');
  await startButton.press('Space');

  await expect(page.getByTestId('home-screen')).toBeHidden();
  await expect(gameCanvas(page)).toBeVisible();
});

test('結束畫面可以重新開始', async ({ page }) => {
  await startGame(page);

  await page.waitForFunction(() => typeof window.__GAME_TEST__?.endGame === 'function');
  await page.evaluate(() => window.__GAME_TEST__?.endGame('energy'));

  await expect(page.getByTestId('game-over-screen')).toBeVisible();
  await page.getByTestId('restart-button').click();

  await expect(page.getByTestId('game-over-screen')).toBeHidden();
  await expect(gameCanvas(page)).toBeVisible();
  await expect(page.getByTestId('pause-button')).toBeVisible();
  await expect(page.locator('[data-distance]')).toHaveText('0 公尺');
});

test('完成三關後顯示 42.195 公里完賽結算', async ({ page }) => {
  await startGame(page);

  await page.waitForFunction(() => typeof window.__GAME_TEST__?.completeGame === 'function');
  await page.evaluate(() => window.__GAME_TEST__?.completeGame());

  await expect(page.getByTestId('game-over-screen')).toBeVisible();
  await expect(page.locator('[data-result-title]')).toHaveText('恭喜順利完賽！');
  await expect(page.locator('[data-result-stage]')).toHaveText('第 3 關・正式比賽');
  await expect(page.locator('[data-result-distance]')).toHaveText('42,195 公尺');
});

test('首頁可開啟與關閉本機排行榜', async ({ page }) => {
  await page.getByTestId('leaderboard-home-button').click();

  await expect(page.getByTestId('leaderboard-modal')).toBeVisible();
  await expect(page.locator('[data-leaderboard-empty]')).toContainText('還沒有本機成績');
  await page.locator('[data-leaderboard-close]').click();
  await expect(page.getByTestId('leaderboard-modal')).toBeHidden();
  await expect(page.getByTestId('leaderboard-home-button')).toBeFocused();
});

test('結算成績可加入前 10 名並在重新載入後保留', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__GAME_TEST__?.completeGame());

  await page.locator('[data-score-name]').fill('慢跑小明');
  await page.locator('[data-score-submit]').click();
  await expect(page.locator('[data-score-save-status]')).toContainText('第 1 名');

  await page.getByTestId('leaderboard-result-button').click();
  const currentRow = page.locator('[data-leaderboard-body] tr[aria-current="true"]');
  await expect(currentRow).toContainText('慢跑小明');
  await expect(currentRow).toContainText('42,195 公尺');
  await expect(currentRow).toContainText('完賽');

  await page.reload();
  await page.getByTestId('leaderboard-home-button').click();
  await expect(page.locator('[data-leaderboard-body]')).toContainText('慢跑小明');
});

test('分享成績在支援時附上 PNG 成績卡', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__GAME_TEST__?.completeGame());
  await page.locator('[data-score-name]').fill('阿跑');
  await page.locator('[data-score-submit]').click();
  await expect(page.locator('[data-score-save-status]')).toContainText('已儲存');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: ShareData) => Boolean(data.files?.length),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        window.__SHARE_TEST__ = {
          text: data.text ?? '',
          fileCount: data.files?.length ?? 0,
          fileType: data.files?.[0]?.type ?? '',
        };
      },
    });
  });

  await page.locator('[data-share-button]').click();
  await expect(page.locator('[data-share-status]')).toHaveText('成績卡已分享！');
  expect(await page.evaluate(() => window.__SHARE_TEST__)).toEqual({
    text: expect.stringContaining('阿跑'),
    fileCount: 1,
    fileType: 'image/png',
  });
});
