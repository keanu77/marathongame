import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameUI } from './GameUI';
import type { LeaderboardRow } from './types';

describe('GameUI', () => {
  let ui: GameUI;

  const mockClipboard = () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    return writeText;
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    ui?.destroy();
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();
  });

  it('首頁清楚呈現基礎期、進階期到正式比賽的三關路線', () => {
    ui = new GameUI({ root: '#app' });

    expect(document.querySelector('h1')?.textContent).toBe('馬拉松完賽訓練');
    expect(document.querySelector('.home-lead')?.textContent).toBe(
      '循序累積、聰明恢復、一路跑完正式比賽',
    );
    expect(
      [...document.querySelectorAll<HTMLElement>('.stage-roadmap strong')].map(
        (element) => element.textContent,
      ),
    ).toEqual(['基礎期', '進階期', '正式比賽']);
    expect(document.querySelector('.route-flow')?.textContent).toContain('基礎期');
    expect(document.querySelector('.route-flow')?.textContent).toContain('正式比賽');
  });

  it('在場景就緒後可由首頁開始並顯示 HUD', () => {
    const onStart = vi.fn();
    ui = new GameUI({ root: '#app', callbacks: { onStart } });
    ui.setStartEnabled(true);

    const startButton = document.querySelector<HTMLButtonElement>('[data-testid="start-button"]');
    startButton?.click();

    expect(onStart).toHaveBeenCalledOnce();
    expect(ui.getView()).toBe('playing');
    expect(document.querySelector<HTMLElement>('.hud-layer')?.hidden).toBe(false);
  });

  it('可從首頁與結算開啟本機排行榜並關閉', () => {
    const onLeaderboardOpen = vi.fn();
    ui = new GameUI({ root: '#app', callbacks: { onLeaderboardOpen } });

    document.querySelector<HTMLButtonElement>('[data-testid="leaderboard-home-button"]')?.click();

    const modal = document.querySelector<HTMLElement>('[data-testid="leaderboard-modal"]');
    expect(onLeaderboardOpen).toHaveBeenCalledOnce();
    expect(modal?.hidden).toBe(false);
    expect(document.querySelector('[data-leaderboard-empty]')?.textContent).toContain(
      '還沒有本機成績',
    );
    expect(document.querySelector('.leaderboard-device-note')?.textContent).toContain(
      '只儲存在此裝置與瀏覽器',
    );

    document.querySelector<HTMLButtonElement>('[data-leaderboard-close]')?.click();
    expect(modal?.hidden).toBe(true);

    ui.showGameOver({
      distanceMeters: 800,
      score: 900,
      highScore: 900,
      failureReason: '體力耗盡',
      educationMessage: '休息是訓練的一部分。',
      educationAction: '安排恢復時間。',
    });
    document.querySelector<HTMLButtonElement>('[data-testid="leaderboard-result-button"]')?.click();

    expect(onLeaderboardOpen).toHaveBeenCalledTimes(2);
    expect(modal?.hidden).toBe(false);
  });

  it('可切換暫停與繼續畫面', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    ui = new GameUI({ root: '#app', callbacks: { onPause, onResume } });
    ui.showPlaying();

    document.querySelector<HTMLButtonElement>('[data-testid="pause-button"]')?.click();
    expect(onPause).toHaveBeenCalledOnce();
    expect(ui.getView()).toBe('paused');

    document.querySelector<HTMLButtonElement>('[data-testid="resume-button"]')?.click();
    expect(onResume).toHaveBeenCalledOnce();
    expect(ui.getView()).toBe('playing');
  });

  it('聲音開關同時控制配樂與音效文案', () => {
    const onSoundChange = vi.fn();
    ui = new GameUI({ root: '#app', callbacks: { onSoundChange } });

    const soundButton = document.querySelector<HTMLButtonElement>('[data-testid="sound-toggle"]');
    expect(soundButton?.getAttribute('aria-label')).toBe('關閉聲音');
    expect(document.querySelector('[data-sound-label]')?.textContent).toBe('聲音：開');

    soundButton?.click();
    expect(onSoundChange).toHaveBeenLastCalledWith(false);
    expect(soundButton?.getAttribute('aria-label')).toBe('開啟聲音');
    expect(document.querySelector('[data-sound-label]')?.textContent).toBe('聲音：關');

    soundButton?.click();
    expect(onSoundChange).toHaveBeenLastCalledWith(true);
    expect(document.querySelector('[data-sound-label]')?.textContent).toBe('聲音：開');
  });

  it('觸發跳躍按鈕時會呼叫遊戲控制 callback', () => {
    const onJump = vi.fn();
    ui = new GameUI({ root: '#app', callbacks: { onJump } });
    ui.showPlaying();

    document
      .querySelector<HTMLButtonElement>('[data-testid="jump-button"]')
      ?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));

    expect(onJump).toHaveBeenCalledOnce();

    document
      .querySelector<HTMLButtonElement>('[data-testid="jump-button"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }));

    expect(onJump).toHaveBeenCalledTimes(2);
  });

  it('HUD 同時呈現關卡、階段、全程進度與文字配速狀態', () => {
    ui = new GameUI({ root: '#app' });
    ui.updateHUD({
      stageNumber: 2,
      totalStages: 3,
      stageName: '進階期',
      overallProgressPercent: 58,
      paceLabel: '進入挑戰配速',
      paceTone: 'challenging',
    });

    expect(document.querySelector('[data-stage-counter]')?.textContent).toBe('第 2 關／共 3 關');
    expect(document.querySelector('[data-stage-name]')?.textContent).toBe('進階期');
    expect(document.querySelector('[data-progress-value]')?.textContent).toBe('58%');
    expect(document.querySelector('[data-pace-state]')?.textContent).toContain('進入挑戰配速');
    expect(document.querySelector('[data-pace-state]')?.getAttribute('data-tone')).toBe(
      'challenging',
    );
    expect(document.querySelector('[data-course-progress]')?.getAttribute('aria-valuenow')).toBe(
      '58',
    );
    expect(document.querySelector('[data-stage-step="1"]')?.getAttribute('data-state')).toBe(
      'completed',
    );
    expect(document.querySelector('[data-stage-step="2"]')?.getAttribute('aria-current')).toBe(
      'step',
    );
  });

  it('中途停止結算會呈現抵達階段、原因、衛教、新紀錄與失敗分享文案', async () => {
    const onShare = vi.fn();
    const writeText = mockClipboard();
    ui = new GameUI({ root: '#app', callbacks: { onShare } });
    ui.showGameOver({
      distanceMeters: 1_280,
      score: 1_430,
      highScore: 1_430,
      failureReason: '訓練量暴增（受傷風險過高）',
      educationMessage: '訓練量應循序增加，不要突然大幅加量。',
      educationAction: '下次只調整時間、距離或強度其中一項。',
      isNewHighScore: true,
      outcome: 'stopped',
      stageNumber: 2,
      stageName: '進階期',
    });

    expect(document.querySelector('[data-result-title]')?.textContent).toBe('本次備賽中止');
    expect(document.querySelector('[data-result-stage]')?.textContent).toBe('第 2 關・進階期');
    expect(document.querySelector('[data-reason-label]')?.textContent).toBe('中途停止原因');
    expect(document.querySelector('[data-result-distance]')?.textContent).toBe('1,280 公尺');
    expect(document.querySelector('[data-failure-reason]')?.textContent).toContain('訓練量暴增');
    expect(document.querySelector('[data-education-message]')?.textContent).toContain('循序增加');
    expect(document.querySelector('[data-education-action]')?.textContent).toContain('其中一項');
    expect(document.querySelector<HTMLElement>('[data-new-record]')?.hidden).toBe(false);
    expect(document.activeElement).toBe(document.querySelector('[data-testid="game-over-screen"]'));

    document.querySelector<HTMLButtonElement>('[data-share-button]')?.click();
    await vi.waitFor(() => expect(onShare).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('抵達第 2 關・進階期'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('不作醫療診斷或個別建議'));
  });

  it('完賽結算有獨立標題、完賽成果與成功分享文案', async () => {
    const onShare = vi.fn();
    const writeText = mockClipboard();
    ui = new GameUI({ root: '#app', callbacks: { onShare } });
    ui.showGameOver({
      distanceMeters: 4_219,
      score: 5_000,
      highScore: 5_000,
      failureReason: '完成基礎期、進階期與正式比賽',
      educationMessage: '回到運動不只看時間，也要評估功能恢復。',
      educationAction: '把這次穩定配速的策略帶到下一次訓練。',
      outcome: 'completed',
      stageNumber: 3,
      stageName: '正式比賽',
    });

    expect(document.querySelector('[data-result-title]')?.textContent).toBe('恭喜順利完賽！');
    expect(document.querySelector('[data-outcome-label]')?.textContent).toBe('完成路線');
    expect(document.querySelector('[data-reason-label]')?.textContent).toBe('完賽成果');
    expect(document.querySelector('[data-outcome-banner]')?.getAttribute('data-outcome')).toBe(
      'completed',
    );

    document.querySelector<HTMLButtonElement>('[data-share-button]')?.click();
    await vi.waitFor(() => expect(onShare).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('42.195 公里'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('分數 5,000｜完賽'));
  });

  it('排行榜只顯示前 10 名、標示本人，且暱稱不會被解析為 HTML', () => {
    ui = new GameUI({ root: '#app' });
    const maliciousName = '<img src=x onerror=alert(1)>';
    const rows: LeaderboardRow[] = Array.from({ length: 12 }, (_, index) => ({
      id: `row-${index + 1}`,
      name: index === 0 ? maliciousName : `跑者 ${index + 1}`,
      score: 2_000 - index * 100,
      distanceMeters: 1_500 - index * 50,
      outcome: index % 2 === 0 ? 'completed' : 'stopped',
    }));

    ui.showLeaderboard(rows, 'row-2');

    const renderedRows = document.querySelectorAll('[data-leaderboard-body] tr');
    expect(renderedRows).toHaveLength(10);
    expect(document.querySelector('[data-leaderboard-body] img')).toBeNull();
    expect(document.querySelector('.leaderboard-name span')?.textContent).toBe(maliciousName);
    expect(renderedRows[1]?.getAttribute('data-current')).toBe('true');
    expect(renderedRows[1]?.textContent).toContain('你');
    expect(document.querySelectorAll('.leaderboard-outcome')).toHaveLength(10);

    ui.showLeaderboard([]);
    expect(document.querySelector<HTMLElement>('[data-leaderboard-empty]')?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-leaderboard-table]')?.hidden).toBe(true);
  });

  it('暱稱必填且最多 12 字，可回報已儲存、未進榜與儲存失敗', () => {
    const onScoreSubmit = vi.fn();
    ui = new GameUI({ root: '#app', callbacks: { onScoreSubmit } });
    ui.showGameOver({
      distanceMeters: 1_200,
      score: 1_500,
      highScore: 1_500,
      failureReason: '完成三關',
      educationMessage: '循序增加訓練量。',
      educationAction: '保留恢復日。',
      outcome: 'completed',
      stageNumber: 3,
      stageName: '正式比賽',
    });

    const input = document.querySelector<HTMLInputElement>('[data-score-name]');
    const submit = document.querySelector<HTMLButtonElement>('[data-score-submit]');
    const status = document.querySelector<HTMLElement>('[data-score-save-status]');
    expect(input?.maxLength).toBe(12);

    submit?.click();
    expect(onScoreSubmit).not.toHaveBeenCalled();
    expect(input?.getAttribute('aria-invalid')).toBe('true');

    if (input) input.value = '  abcdefghijklmnop  ';
    submit?.click();
    expect(onScoreSubmit).toHaveBeenCalledWith('abcdefghijkl');
    expect(input?.disabled).toBe(true);

    ui.setScoreSaved(3, '<b>跑者</b>');
    expect(status?.textContent).toContain('第 3 名');
    expect(document.querySelector('[data-score-form] b')).toBeNull();

    ui.resetScoreSubmission();
    expect(input?.value).toBe('');
    expect(input?.disabled).toBe(false);
    expect(submit?.disabled).toBe(false);

    if (input) input.value = '重試者';
    submit?.click();
    ui.setScoreSaveError('<b>寫入失敗</b>');
    expect(input?.disabled).toBe(false);
    expect(submit?.disabled).toBe(false);
    expect(submit?.textContent).toBe('重新儲存');
    expect(status?.textContent).toBe('<b>寫入失敗</b>');
    expect(document.querySelector('[data-score-save-status] b')).toBeNull();

    ui.setScoreSaved(null, '未進榜跑者');
    expect(submit?.textContent).toBe('未進榜');
    expect(submit?.disabled).toBe(true);
    expect(status?.textContent).toBe('本次成績未進前 10，未列入排行榜。');
  });
});
