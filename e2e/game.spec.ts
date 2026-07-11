import { expect, test, type Page, type Route } from '@playwright/test';

import type { MusicPlaybackState } from '../src/game/utils/SoundManager';

declare global {
  interface Window {
    __GAME_TEST__?: {
      endGame: (reason?: 'energy' | 'injuryRisk') => void;
      completeGame: () => void;
      getPlayerState: () => string;
      setStage: (stageId: 'base' | 'build' | 'race') => void;
      getMusicState: () => MusicPlaybackState;
      showFeedback: (kind: 'injury' | 'nutrition' | 'education') => void;
      setHudStatusCount: (count: 0 | 3) => void;
    };
    __SHARE_TEST__?: {
      text: string;
      fileCount: number;
      fileType: string;
      imageWidth: number;
      imageHeight: number;
    };
  }
}

const gameCanvas = (page: Page) => page.getByTestId('game-canvas');

const browserErrors = new WeakMap<Page, string[]>();

interface MockLeaderboardEntry {
  id: string;
  name: string;
  score: number;
  distanceMeters: number;
  outcome: 'completed' | 'stopped';
  stageId: 'base' | 'build' | 'race';
}

function fulfillJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockLeaderboardApi(page: Page, entries: MockLeaderboardEntry[]) {
  let runSequence = 0;

  await page.route('**/api/runs', async (route) => {
    const runId = `e2e-run-${++runSequence}`;
    await fulfillJson(route, {
      run: {
        id: runId,
        token: `e2e-token-${runId}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        rulesVersion: 'e2e-v1',
      },
    });
  });

  await page.route('**/api/runs/*/checkpoint', async (route) => {
    await fulfillJson(route, { accepted: true });
  });

  await page.route('**/api/runs/*/finish', async (route) => {
    const body = route.request().postDataJSON() as { name?: unknown };
    const runId = new URL(route.request().url()).pathname.split('/')[3] ?? 'e2e-run';
    const entry: MockLeaderboardEntry = {
      id: `entry-${runId}`,
      name:
        typeof body.name === 'string' && body.name.trim() !== '' ? body.name.trim() : '匿名跑者',
      score: 42_195,
      distanceMeters: 42_195,
      outcome: 'completed',
      stageId: 'race',
    };

    entries.unshift(entry);
    await fulfillJson(route, { entry, rank: 1 });
  });

  await page.route('**/api/leaderboard', async (route) => {
    await fulfillJson(route, {
      entries,
      updatedAt: new Date().toISOString(),
    });
  });
}

async function startGame(page: Page) {
  await page.getByTestId('start-button').click();
  await expect(gameCanvas(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  const entries: MockLeaderboardEntry[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await mockLeaderboardApi(page, entries);
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

test('頁尾顯示製作者連結且手機版不會水平溢位', async ({ page }) => {
  const creatorLink = page.getByTestId('creator-link');
  await expect(creatorLink).toBeVisible();
  await expect(creatorLink).toHaveText('運動醫學科 吳易澄醫師');
  await expect(creatorLink).toHaveAttribute('href', 'https://sportsmedicine.tw/');
  await expect(creatorLink).toHaveAttribute('target', '_blank');
  await expect(creatorLink).toHaveAttribute('rel', /noopener/);

  const layout = await page.evaluate(() => {
    const footer = document.querySelector<HTMLElement>('.medical-disclaimer');
    const creatorLink = document.querySelector<HTMLElement>('[data-testid="creator-link"]');
    return {
      footerBottom: footer?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
      creatorLinkHeight: creatorLink?.getBoundingClientRect().height ?? 0,
      viewportHeight: window.innerHeight,
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.creatorLinkHeight).toBeGreaterThanOrEqual(44);
  expect(layout.hasHorizontalOverflow).toBe(false);
});

test('點擊開始後進入遊戲', async ({ page }) => {
  await startGame(page);

  await expect(page.getByTestId('home-screen')).toBeHidden();
  await expect(page.getByTestId('pause-button')).toBeVisible();
});

test('開局無法取得排行榜憑證時會立即提醒', async ({ page }) => {
  await page.route(
    '**/api/runs',
    async (route) => {
      await fulfillJson(
        route,
        {
          error: {
            code: 'ORIGIN_NOT_ALLOWED',
            message: '只接受遊戲網站送出的同源請求。',
          },
        },
        403,
      );
    },
    { times: 1 },
  );

  await startGame(page);

  const feedback = page.getByTestId('game-feedback');
  await expect(feedback).toContainText('排行榜未連線');
  await expect(feedback).toContainText('正式遊戲網址');

  const expectedErrors = browserErrors.get(page) ?? [];
  expect(expectedErrors).toHaveLength(1);
  expect(expectedErrors[0]).toContain('403');
  browserErrors.set(page, []);
});

test('遊戲畫布存在', async ({ page }) => {
  await startGame(page);

  await expect(gameCanvas(page)).toHaveCount(1);
  const backingBuffer = await gameCanvas(page).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      horizontalRatio: canvas.width / rect.width,
      verticalRatio: canvas.height / rect.height,
      targetRatio: Math.min(2, window.devicePixelRatio),
    };
  });
  expect(backingBuffer.horizontalRatio).toBeGreaterThanOrEqual(backingBuffer.targetRatio - 0.01);
  expect(backingBuffer.verticalRatio).toBeGreaterThanOrEqual(backingBuffer.targetRatio - 0.01);
});

test('三關 Canvas 天空使用不同且非黑色的相容色彩', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('pause-button').click();

  const samples: number[][] = [];
  for (const stageId of ['base', 'build', 'race'] as const) {
    await page.evaluate((stage) => window.__GAME_TEST__?.setStage(stage), stageId);
    await page.waitForTimeout(80);
    const sample = await gameCanvas(page).evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      return context ? [...context.getImageData(canvas.width / 2, 40, 1, 1).data] : [];
    });
    samples.push(sample);
  }

  samples.forEach((sample) => {
    expect(sample).toHaveLength(4);
    expect((sample[0] ?? 0) + (sample[1] ?? 0) + (sample[2] ?? 0)).toBeGreaterThan(120);
    expect(sample[3]).toBe(255);
  });
  expect(new Set(samples.map((sample) => sample.slice(0, 3).join(','))).size).toBe(3);
});

test('手機 HUD 保留跑道空間，受傷與補給提示不再被遮住', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', '此檢查只針對手機直式版面');
  await startGame(page);

  const compactLayout = await page.evaluate(() => {
    const frame = document.querySelector('.game-frame')?.getBoundingClientRect();
    const selectors = ['.hud-top-actions', '.stage-hud', '.hud-summary', '.vitals-card'];
    const boxes = selectors.map((selector) =>
      document.querySelector(selector)?.getBoundingClientRect(),
    );
    const pauseButton = document
      .querySelector('[data-testid="pause-button"]')
      ?.getBoundingClientRect();
    const hudFontSizes = [
      ...document.querySelectorAll<HTMLElement>(
        '.metric-label, .metric-card strong, .vital-heading, .status-chip',
      ),
    ].map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    if (!frame || boxes.some((box) => !box) || !pauseButton) return null;

    return {
      frameHeight: frame.height,
      occupiedHeight: Math.max(...boxes.map((box) => box?.bottom ?? 0)) - frame.top,
      pauseWidth: pauseButton.width,
      pauseHeight: pauseButton.height,
      neutralStatusActive:
        document.querySelector('[data-status-region]')?.getAttribute('data-active') ?? '',
      minimumHudFontSize: Math.min(...hudFontSizes),
    };
  });

  expect(compactLayout).not.toBeNull();
  expect(compactLayout?.occupiedHeight ?? Infinity).toBeLessThanOrEqual(
    (compactLayout?.frameHeight ?? 0) * 0.35,
  );
  expect(compactLayout?.pauseWidth ?? 0).toBeGreaterThanOrEqual(44);
  expect(compactLayout?.pauseHeight ?? 0).toBeGreaterThanOrEqual(44);
  expect(compactLayout?.neutralStatusActive).toBe('false');
  expect(compactLayout?.minimumHudFontSize ?? 0).toBeGreaterThanOrEqual(12);

  const feedback = page.getByTestId('game-feedback');

  const feedbackLayout = await page.evaluate(() => {
    window.__GAME_TEST__?.setHudStatusCount(3);
    window.__GAME_TEST__?.showFeedback('education');
    const frame = document.querySelector('.game-frame')?.getBoundingClientRect();
    const vitals = document.querySelector('.vitals-card')?.getBoundingClientRect();
    const status = document.querySelector('[data-status-region]')?.getBoundingClientRect();
    const feedbackElement = document.querySelector('[data-testid="game-feedback"]');
    const feedback = feedbackElement?.getBoundingClientRect();
    if (!frame || !vitals || !status || !feedback) return null;
    return {
      frameBottom: frame.bottom,
      frameHeight: frame.height,
      statusBottom: status.bottom,
      occupiedHeight: feedback.bottom - frame.top,
      feedbackAnchorBottom: Math.max(vitals.bottom, status.bottom),
      feedbackTop: feedback.top,
      feedbackBottom: feedback.bottom,
      feedbackText: feedbackElement?.textContent ?? '',
      statusCount: document.querySelectorAll('[data-status-list] [data-status-id]').length,
    };
  });

  expect(feedbackLayout).not.toBeNull();
  expect(feedbackLayout?.statusCount).toBe(3);
  expect(feedbackLayout?.feedbackText).toContain('營養補給');
  expect(feedbackLayout?.feedbackText).toContain('補給需求會受運動時間');
  expect(feedbackLayout?.feedbackTop ?? 0).toBeGreaterThanOrEqual(
    feedbackLayout?.feedbackAnchorBottom ?? Infinity,
  );
  expect(feedbackLayout?.feedbackBottom ?? Infinity).toBeLessThan(feedbackLayout?.frameBottom ?? 0);
  expect(feedbackLayout?.occupiedHeight ?? Infinity).toBeLessThanOrEqual(
    (feedbackLayout?.frameHeight ?? 0) * 0.4,
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.evaluate(() => window.__GAME_TEST__?.showFeedback('injury'));
  await expect(feedback).toContainText('受傷');
  await expect(feedback).toHaveCSS('opacity', '1');
  await page.waitForTimeout(500);
  await expect(feedback).toContainText('受傷');
  await page.waitForTimeout(1_000);
  await expect(feedback).toBeEmpty();
});

test('320px 窄版手機仍完整呈現體力與受傷風險文字', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', '此檢查只針對手機直式版面');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();
  await startGame(page);

  const layout = await page.evaluate(() => {
    const frame = document.querySelector('.game-frame')?.getBoundingClientRect();
    const vitals = document.querySelector('.vitals-card')?.getBoundingClientRect();
    const vitalTexts = [
      ...document.querySelectorAll<HTMLElement>('.vital-heading > span, .vital-heading > strong'),
    ];
    if (!frame || !vitals || vitalTexts.length !== 4) return null;
    return {
      occupiedHeight: vitals.bottom - frame.top,
      frameHeight: frame.height,
      allVitalTextFits: vitalTexts.every(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    };
  });

  expect(layout).not.toBeNull();
  expect(layout?.occupiedHeight ?? Infinity).toBeLessThanOrEqual((layout?.frameHeight ?? 0) * 0.35);
  expect(layout?.allVitalTextFits).toBe(true);
  await expect(page.locator('[data-energy-value]')).toHaveText('100 / 100');
  await expect(page.locator('[data-risk-value]')).toHaveText('0 / 100');
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

test('結算頁可展開並切換訓練、傷害與營養衛教提醒', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__GAME_TEST__?.completeGame());

  const hub = page.getByTestId('education-hub');
  const summary = page.locator('[data-education-hub] > summary');
  await expect(hub).toBeVisible();
  await expect(hub).not.toHaveAttribute('open', '');
  await expect(summary).toContainText('衛教補給站');
  await expect(summary).toContainText('本局先看：跑步營養');

  await summary.click();
  await expect(hub).toHaveAttribute('open', '');
  await expect(page.locator('[data-education-topic]')).toHaveCount(3);
  await expect(page.locator('[data-education-safety-alert]')).toContainText('緊急醫療');

  const trainingButton = page.locator('[data-education-topic="training"]');
  await trainingButton.click();
  await expect(trainingButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-education-reminder-card]')).toHaveAttribute(
    'data-topic',
    'training',
  );
  await expect(page.locator('[data-reminder-title]')).not.toBeEmpty();
  await expect(page.locator('[data-reminder-source]')).toHaveAttribute('target', '_blank');

  const layout = await page.evaluate(() => {
    const resultCard = document.querySelector<HTMLElement>('.result-card');
    const topicButton = document.querySelector<HTMLElement>('[data-education-topic="training"]');
    const summary = document.querySelector<HTMLElement>('[data-education-hub] > summary');
    if (!resultCard || !topicButton || !summary) return null;
    return {
      noHorizontalOverflow: resultCard.scrollWidth <= resultCard.clientWidth + 1,
      summaryHeight: summary.getBoundingClientRect().height,
      topicButtonHeight: topicButton.getBoundingClientRect().height,
    };
  });
  expect(layout).not.toBeNull();
  expect(layout?.noHorizontalOverflow).toBe(true);
  expect(layout?.summaryHeight ?? 0).toBeGreaterThanOrEqual(44);
  expect(layout?.topicButtonHeight ?? 0).toBeGreaterThanOrEqual(44);
});

test('首頁可開啟與關閉跨裝置排行榜', async ({ page }) => {
  await page.getByTestId('leaderboard-home-button').click();

  await expect(page.getByTestId('leaderboard-modal')).toBeVisible();
  await expect(page.getByRole('heading', { name: '跨裝置排行榜' })).toBeVisible();
  await expect(page.locator('[data-leaderboard-empty]')).toContainText('還沒有網路成績');
  await page.locator('[data-leaderboard-close]').click();
  await expect(page.getByTestId('leaderboard-modal')).toBeHidden();
  await expect(page.getByTestId('leaderboard-home-button')).toBeFocused();
});

test('排行榜載入錯誤時顯示可理解的同步狀態', async ({ page }) => {
  await page.route(
    '**/api/leaderboard',
    async (route) => {
      await fulfillJson(route, {
        entries: 'temporarily-unavailable',
        updatedAt: new Date().toISOString(),
      });
    },
    { times: 1 },
  );

  await page.getByTestId('leaderboard-home-button').click();

  const errorState = page.locator('[data-leaderboard-empty][data-state="error"]');
  await expect(errorState).toBeVisible();
  await expect(errorState).toContainText('暫時無法同步');
});

test('關閉同步中的排行榜後不會被慢速回應重新開啟', async ({ page }) => {
  await page.route(
    '**/api/leaderboard',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await fulfillJson(route, { entries: [], updatedAt: new Date().toISOString() });
    },
    { times: 1 },
  );

  await page.getByTestId('leaderboard-home-button').click();
  await expect(page.locator('[data-leaderboard-empty]')).toContainText('正在同步排行榜');
  await page.locator('[data-leaderboard-close]').click();
  await page.waitForTimeout(450);

  await expect(page.getByTestId('leaderboard-modal')).toBeHidden();
});

test('結算成績經伺服器驗證後可跨重新載入保留', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__GAME_TEST__?.completeGame());

  await page.locator('[data-score-name]').fill('慢跑小明');
  await page.locator('[data-score-submit]').click();
  await expect(page.locator('[data-score-save-status]')).toContainText('通過伺服器驗證');
  await expect(page.locator('[data-score-save-status]')).toContainText('第 1 名');

  await page.getByTestId('leaderboard-result-button').click();
  const currentRow = page.locator('[data-leaderboard-body] tr[aria-current="true"]');
  await expect(currentRow).toContainText('慢跑小明');
  await expect(currentRow).toContainText('42,195 公尺');
  await expect(currentRow).toContainText('完賽');

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('leaderboard-home-button').click();
  await expect(page.locator('[data-leaderboard-body]')).toContainText('慢跑小明');
});

test('完賽檢查點暫時失敗後，送出成績會自動補送並儲存', async ({ page }) => {
  let checkpointAttempts = 0;
  await page.route('**/api/runs/*/checkpoint', async (route) => {
    checkpointAttempts += 1;
    if (checkpointAttempts === 1) {
      await fulfillJson(
        route,
        { error: { code: 'TEMPORARY_FAILURE', message: '暫時無法儲存。' } },
        503,
      );
      return;
    }
    await fulfillJson(route, { accepted: true });
  });

  await startGame(page);
  await page.evaluate(() => window.__GAME_TEST__?.completeGame());
  await page.locator('[data-score-name]').fill('補送跑者');
  await page.locator('[data-score-submit]').click();

  await expect(page.locator('[data-score-save-status]')).toContainText('通過伺服器驗證');
  expect(checkpointAttempts).toBe(2);

  // Chromium reports our deliberately injected 503 as a console resource
  // error. Assert it is the only error, then clear this expected test signal.
  const expectedErrors = browserErrors.get(page) ?? [];
  expect(expectedErrors).toHaveLength(1);
  expect(expectedErrors[0]).toContain('503');
  browserErrors.set(page, []);
});

test('分享成績在支援時附上 PNG 成績卡', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__GAME_TEST__?.completeGame());
  await page.locator('[data-score-name]').fill('阿跑');
  await page.locator('[data-score-submit]').click();
  await expect(page.locator('[data-score-save-status]')).toContainText('通過伺服器驗證');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: ShareData) => Boolean(data.files?.length),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        const bitmap = file ? await createImageBitmap(file) : null;
        window.__SHARE_TEST__ = {
          text: data.text ?? '',
          fileCount: data.files?.length ?? 0,
          fileType: file?.type ?? '',
          imageWidth: bitmap?.width ?? 0,
          imageHeight: bitmap?.height ?? 0,
        };
        bitmap?.close();
      },
    });
  });

  await page.locator('[data-share-button]').click();
  await expect(page.locator('[data-share-status]')).toHaveText('成績卡已分享！');
  expect(await page.evaluate(() => window.__SHARE_TEST__)).toEqual({
    text: expect.stringContaining('排行榜第 1 名'),
    fileCount: 1,
    fileType: 'image/png',
    imageWidth: 1_080,
    imageHeight: 1_080,
  });
});

test('不支援圖片 Web Share 時仍可儲存 FB／IG 方形成績圖', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__GAME_TEST__?.completeGame());
  await page.locator('[data-score-name]').fill('分享跑者');
  await page.locator('[data-score-submit]').click();
  await expect(page.locator('[data-score-save-status]')).toContainText('第 1 名');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => false,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        window.__SHARE_TEST__ = {
          text: data.text ?? '',
          fileCount: data.files?.length ?? 0,
          fileType: data.files?.[0]?.type ?? '',
          imageWidth: 0,
          imageHeight: 0,
        };
      },
    });
  });

  await page.locator('[data-share-button]').click();
  await expect(page.locator('[data-share-status]')).toContainText('儲存分享圖');
  expect(await page.evaluate(() => window.__SHARE_TEST__)).toMatchObject({
    text: expect.stringContaining('排行榜第 1 名'),
    fileCount: 0,
  });

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('download-share-card-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('marathon-finish-training-score.png');
  await expect(page.locator('[data-share-status]')).toHaveText('1080×1080 成績分享圖已儲存！');
});
