import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EducationReminderCard, RunKnowledgeItem } from '../shared/education';
import { GameUI } from './GameUI';
import type { LeaderboardRow } from './types';

const TEST_EDUCATION_REMINDERS = [
  {
    id: 'training-test',
    topic: 'training',
    topicLabel: '馬拉松訓練',
    icon: '📈',
    title: '一次只加一點',
    message: '訓練量應循序增加。',
    action: '本週只調整一項。',
    source: { label: '訓練來源', url: 'https://example.com/training' },
  },
  {
    id: 'injury-test',
    topic: 'injury',
    topicLabel: '運動傷害',
    icon: '🦵',
    title: '疼痛加重要停下',
    message: '功能下降時不要硬撐。',
    action: '停止誘發症狀的活動。',
    source: { label: '傷害來源', url: 'https://example.com/injury' },
  },
  {
    id: 'nutrition-test',
    topic: 'nutrition',
    topicLabel: '跑步營養',
    icon: '💧',
    title: '補給先在訓練測試',
    message: '需求會隨環境與時間改變。',
    action: '記錄自己的腸胃反應。',
    source: { label: '營養來源', url: 'https://example.com/nutrition' },
  },
] as const satisfies readonly EducationReminderCard[];

const TEST_KNOWLEDGE_REVIEW = [
  {
    id: 'recoveryItem:interval',
    kind: 'recoveryItem',
    label: '間歇訓練',
    message: '間歇訓練能提高速度刺激，但也會增加當次訓練成本。',
    action: '高強度課表之間保留恢復。',
  },
  {
    id: 'obstacle:sportsInjury',
    kind: 'obstacle',
    label: '運動傷害',
    message: '疼痛、腫脹或功能下降時，不應只靠意志力繼續訓練。',
    action: '先停止造成症狀的活動。',
  },
] as const satisfies readonly RunKnowledgeItem[];

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
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'canShare');
    vi.useRealTimers();
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

  it('網頁最下方顯示製作者與安全的官方網站連結', () => {
    ui = new GameUI({ root: '#app' });

    const footer = document.querySelector<HTMLElement>('.medical-disclaimer');
    const creatorLink = document.querySelector<HTMLAnchorElement>('[data-testid="creator-link"]');
    expect(footer?.textContent).toContain('製作者');
    expect(creatorLink?.textContent).toBe('運動醫學科 吳易澄醫師');
    expect(creatorLink?.href).toBe('https://sportsmedicine.tw/');
    expect(creatorLink?.target).toBe('_blank');
    expect(creatorLink?.rel).toContain('noopener');
    expect(creatorLink?.rel).toContain('noreferrer');
    expect(footer?.hidden).toBe(false);

    ui.showPlaying();
    expect(footer?.hidden).toBe(true);
    expect(document.querySelector('#app')?.getAttribute('data-game-view')).toBe('playing');

    ui.setPaused(true);
    expect(footer?.hidden).toBe(true);
    expect(document.querySelector('#app')?.getAttribute('data-game-view')).toBe('paused');

    ui.showGameOver({
      distanceMeters: 100,
      score: 10,
      highScore: 10,
      failureReason: '測試',
      educationMessage: '測試訊息',
      educationAction: '測試行動',
    });
    expect(footer?.hidden).toBe(false);
    expect(footer?.inert).toBe(true);
    ui.showHome();
    expect(footer?.hidden).toBe(false);
    expect(footer?.inert).toBe(false);
  });

  it('核心操作與狀態使用一致的 SVG 圖示並保留文字標籤', () => {
    ui = new GameUI({ root: '#app' });

    const coreIconSelectors = [
      '[data-testid="start-button"] .ui-icon--play',
      '[data-testid="pause-button"] .ui-icon--pause',
      '[data-testid="sound-toggle"] .ui-icon--sound',
      '[data-energy-meter] .ui-icon--energy',
      '[data-risk-meter] .ui-icon--risk',
      '[data-testid="jump-button"] .ui-icon--jump',
      '[data-testid="leaderboard-home-button"] .ui-icon--leaderboard',
      '[data-testid="leaderboard-result-button"] .ui-icon--leaderboard',
      '[data-testid="restart-button"] .ui-icon--restart',
      '[data-share-button] .ui-icon--share',
      '[data-download-share-card] .ui-icon--download',
      '[data-leaderboard-close] .ui-icon--close',
    ];

    coreIconSelectors.forEach((selector) => {
      const icon = document.querySelector<HTMLElement>(selector);
      expect(icon, selector).not.toBeNull();
      expect(icon?.querySelector('svg'), selector).not.toBeNull();
      expect(icon?.getAttribute('aria-hidden'), selector).toBe('true');
    });

    expect(document.querySelector('[data-testid="pause-button"]')?.textContent).toContain('暫停');
    expect(document.querySelector('[data-testid="jump-button"]')?.textContent).toContain('跳躍');
    expect(document.querySelector('[data-energy-meter]')?.textContent).toContain('體力');
    expect(document.querySelector('[data-risk-meter]')?.textContent).toContain('受傷風險');
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

  it('可從首頁與結算開啟跨裝置排行榜並關閉', () => {
    const onLeaderboardOpen = vi.fn();
    ui = new GameUI({ root: '#app', callbacks: { onLeaderboardOpen } });

    document.querySelector<HTMLButtonElement>('[data-testid="leaderboard-home-button"]')?.click();

    const modal = document.querySelector<HTMLElement>('[data-testid="leaderboard-modal"]');
    expect(onLeaderboardOpen).toHaveBeenCalledOnce();
    expect(modal?.hidden).toBe(false);
    expect(ui.isLeaderboardOpen()).toBe(true);
    expect(document.querySelector('[data-leaderboard-empty]')?.textContent).toContain(
      '還沒有網路成績',
    );
    expect(document.querySelector('.leaderboard-device-note')?.textContent).toContain(
      '通過伺服器規則檢查',
    );

    document.querySelector<HTMLButtonElement>('[data-leaderboard-close]')?.click();
    expect(modal?.hidden).toBe(true);
    expect(ui.isLeaderboardOpen()).toBe(false);

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
    const soundIcon = document.querySelector<HTMLElement>('[data-sound-icon]');
    expect(soundButton?.getAttribute('aria-label')).toBe('關閉聲音');
    expect(document.querySelector('[data-sound-label]')?.textContent).toBe('聲音：開');
    expect(soundIcon?.dataset.state).toBe('on');

    soundButton?.click();
    expect(onSoundChange).toHaveBeenLastCalledWith(false);
    expect(soundButton?.getAttribute('aria-label')).toBe('開啟聲音');
    expect(document.querySelector('[data-sound-label]')?.textContent).toBe('聲音：關');
    expect(soundIcon?.dataset.state).toBe('off');

    soundButton?.click();
    expect(onSoundChange).toHaveBeenLastCalledWith(true);
    expect(document.querySelector('[data-sound-label]')?.textContent).toBe('聲音：開');
    expect(soundIcon?.dataset.state).toBe('on');
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
    expect(document.querySelector('.hud-summary')?.getAttribute('data-priority')).toBe('secondary');
    expect(document.querySelector('.hud-summary')?.getAttribute('aria-label')).toBe('本局次要資訊');

    const hud = document.querySelector<HTMLElement>('.hud-layer');
    const stage = document.querySelector<HTMLElement>('.stage-hud');
    const vitals = document.querySelector<HTMLElement>('.vitals-card');
    const status = document.querySelector<HTMLElement>('.status-region');
    const summary = document.querySelector<HTMLElement>('.hud-summary');
    const children = [...(hud?.children ?? [])];
    expect(children.indexOf(stage as Element)).toBeLessThan(children.indexOf(vitals as Element));
    expect(children.indexOf(vitals as Element)).toBeLessThan(children.indexOf(status as Element));
    expect(children.indexOf(status as Element)).toBeLessThan(children.indexOf(summary as Element));
  });

  it('手機 HUD 可辨識沒有特殊狀態，並在效果啟用時標記為顯示', () => {
    ui = new GameUI({ root: '#app' });
    const region = document.querySelector<HTMLElement>('[data-status-region]');

    expect(region?.dataset.active).toBe('false');
    expect(region?.textContent).toContain('狀態良好');

    ui.updateHUD({
      statuses: [
        {
          id: 'strength-protection',
          icon: '🛡️',
          label: '阻力訓練防護',
          remainingSeconds: 4.2,
          tone: 'positive',
        },
      ],
    });

    expect(region?.dataset.active).toBe('true');
    expect(region?.textContent).toContain('阻力訓練防護 5 秒');
    expect(region?.querySelector('.status-chip')?.classList.contains('status-chip--entering')).toBe(
      true,
    );

    ui.updateHUD({
      statuses: [
        {
          id: 'strength-protection',
          label: '阻力訓練防護',
          remainingSeconds: 3.2,
          tone: 'positive',
        },
      ],
    });

    expect(region?.textContent).toContain('阻力訓練防護 4 秒');
    expect(region?.querySelector('.status-chip')?.classList.contains('status-chip--entering')).toBe(
      false,
    );
  });

  it('關卡進場提示期間標記 HUD，結束後可恢復完整資訊', () => {
    ui = new GameUI({ root: '#app' });
    const hud = document.querySelector<HTMLElement>('.hud-layer');

    ui.setStageTransitionActive(true);
    expect(hud?.dataset.stageTransition).toBe('true');

    ui.setStageTransitionActive(false);
    expect(hud?.dataset.stageTransition).toBe('false');
  });

  it('受傷與補給回饋使用獨立即時提示並在顯示時間結束後清除', () => {
    vi.useFakeTimers();
    ui = new GameUI({ root: '#app' });
    const feedback = document.querySelector<HTMLElement>('[data-game-feedback]');

    ui.showFeedback('營養補給：體力恢復', 'positive', 1_250);
    expect(feedback?.textContent).toBe('營養補給：體力恢復');
    expect(feedback?.dataset.tone).toBe('positive');
    expect(feedback?.style.getPropertyValue('--feedback-duration')).toBe('1250ms');
    expect(feedback?.classList.contains('game-feedback--visible')).toBe(true);

    vi.advanceTimersByTime(1_250);
    expect(feedback?.textContent).toBe('');
    expect(feedback?.classList.contains('game-feedback--visible')).toBe(false);
  });

  it('即時回饋可顯示兩行衛教文字', () => {
    ui = new GameUI({ root: '#app' });
    const feedback = document.querySelector<HTMLElement>('[data-game-feedback]');

    ui.showFeedback('間歇：下一補給提前\n💡 高強度課表之間要保留恢復。', 'positive', 2_800);

    expect(feedback?.textContent).toContain('\n💡');
    expect(feedback?.style.getPropertyValue('--feedback-duration')).toBe('2800ms');
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

  it('結算衛教補給站預設收合，並可切換訓練、傷害與營養提醒', () => {
    ui = new GameUI({ root: '#app' });
    ui.showGameOver({
      distanceMeters: 8_000,
      score: 1_200,
      highScore: 1_200,
      failureReason: '運動傷害',
      educationMessage: '疼痛加重時不要硬撐。',
      educationAction: '先停止造成症狀的活動。',
      educationReminders: TEST_EDUCATION_REMINDERS,
      educationFocusTopic: 'injury',
      educationSafetyAlert: {
        title: '需要立即停下的警訊',
        message: '胸痛或昏倒時立即停止並求助。',
      },
      knowledgeReview: TEST_KNOWLEDGE_REVIEW,
      outcome: 'stopped',
      stageNumber: 2,
      stageName: '進階期',
    });

    const hub = document.querySelector<HTMLDetailsElement>('[data-education-hub]');
    const topicButtons = document.querySelectorAll<HTMLButtonElement>('[data-education-topic]');
    expect(hub?.hidden).toBe(false);
    expect(hub?.open).toBe(false);
    expect(topicButtons).toHaveLength(3);
    expect(
      document.querySelector('[data-education-topic="injury"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(document.querySelector('[data-reminder-title]')?.textContent).toBe('疼痛加重要停下');
    expect(document.querySelector('[data-education-hub-teaser]')?.textContent).toContain(
      '本局先看：運動傷害',
    );
    expect(document.querySelector('[data-safety-alert-message]')?.textContent).toContain('胸痛');
    expect(document.querySelectorAll('[data-knowledge-review-list] li')).toHaveLength(2);
    expect(document.querySelector('[data-knowledge-review-list]')?.textContent).toContain(
      '間歇訓練能提高速度刺激',
    );
    expect(document.querySelector('[data-knowledge-review-list]')?.textContent).toContain(
      '可以這樣做：先停止造成症狀的活動。',
    );
    expect(
      document.querySelector('[data-testid="game-over-screen"]')?.getAttribute('aria-describedby'),
    ).toContain('game-over-disclaimer');
    expect(document.querySelector('#game-over-disclaimer')?.textContent).toContain(
      '不取代醫療診斷',
    );

    document.querySelector<HTMLButtonElement>('[data-education-topic="nutrition"]')?.click();
    expect(
      document.querySelector('[data-education-reminder-card]')?.getAttribute('data-topic'),
    ).toBe('nutrition');
    expect(document.querySelector('[data-reminder-title]')?.textContent).toBe('補給先在訓練測試');
    expect(document.querySelector('[data-reminder-source]')?.getAttribute('href')).toBe(
      'https://example.com/nutrition',
    );
    expect(
      document.querySelector('[data-education-topic="nutrition"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(document.querySelector('[data-education-hub-teaser]')?.textContent).toContain(
      '本局先看：運動傷害',
    );
  });

  it('衛教動態文字只當作純文字，且不接受非 HTTPS 來源', () => {
    ui = new GameUI({ root: '#app' });
    const unsafeReminder: EducationReminderCard = {
      ...TEST_EDUCATION_REMINDERS[0],
      title: '<img src=x onerror=alert(1)>',
      source: { label: '不安全來源', url: 'javascript:alert(1)' },
    };
    ui.showGameOver({
      distanceMeters: 100,
      score: 10,
      highScore: 10,
      failureReason: '測試',
      educationMessage: '測試訊息',
      educationAction: '測試行動',
      educationReminders: [unsafeReminder],
      educationFocusTopic: 'training',
      knowledgeReview: [
        {
          ...TEST_KNOWLEDGE_REVIEW[0],
          message: '<img src=x onerror=alert(1)>',
        },
      ],
    });

    expect(document.querySelector('[data-reminder-title]')?.textContent).toBe(
      '<img src=x onerror=alert(1)>',
    );
    expect(document.querySelector('[data-education-reminder-card] img')).toBeNull();
    expect(document.querySelector('[data-knowledge-review-list]')?.textContent).toContain(
      '<img src=x onerror=alert(1)>',
    );
    expect(document.querySelector('[data-knowledge-review-list] img')).toBeNull();
    expect(document.querySelector<HTMLAnchorElement>('[data-reminder-source]')?.hidden).toBe(true);
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
      score: index < 2 ? 2_000 : 2_000 - (index - 1) * 100,
      distanceMeters: index < 2 ? 1_500 : 1_500 - (index - 1) * 50,
      outcome: index < 6 ? 'completed' : 'stopped',
    }));

    ui.showLeaderboard(rows, 'row-2');

    const renderedRows = document.querySelectorAll('[data-leaderboard-body] tr');
    expect(renderedRows).toHaveLength(10);
    expect(document.querySelector('[data-leaderboard-body] img')).toBeNull();
    expect(document.querySelector('.leaderboard-name span')?.textContent).toBe(maliciousName);
    expect(renderedRows[1]?.getAttribute('data-current')).toBe('true');
    expect(renderedRows[1]?.textContent).toContain('你');
    expect(document.querySelectorAll('.leaderboard-outcome')).toHaveLength(10);
    expect(document.querySelectorAll('.leaderboard-rank__medal')).toHaveLength(3);
    const scrollRegion = document.querySelector<HTMLElement>('[data-leaderboard-table]');
    expect(scrollRegion?.getAttribute('tabindex')).toBe('0');
    expect(scrollRegion?.getAttribute('aria-label')).toContain('左右滑動');
    expect(scrollRegion?.querySelector('.leaderboard-scroll-hint')?.textContent).toContain(
      '左右滑動查看里程與結果',
    );
    expect(renderedRows[0]?.getAttribute('data-rank')).toBe('1');
    expect(renderedRows[2]?.getAttribute('data-rank')).toBe('3');
    expect(renderedRows[2]?.getAttribute('style')).toContain('--leaderboard-row-index: 2');
    expect(
      Array.from(document.querySelectorAll('.leaderboard-rank'), (cell) => cell.textContent).slice(
        0,
        3,
      ),
    ).toEqual(['#1', '#1', '#3']);

    ui.showLeaderboard([]);
    expect(document.querySelector<HTMLElement>('[data-leaderboard-empty]')?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-leaderboard-table]')?.hidden).toBe(true);
  });

  it('排行榜可顯示同步中與安全的網路錯誤訊息', () => {
    ui = new GameUI({ root: '#app' });

    ui.setLeaderboardLoading();
    expect(document.querySelector('[data-leaderboard-empty]')?.textContent).toContain(
      '正在同步排行榜',
    );

    ui.setLeaderboardError('<img src=x onerror=alert(1)>');
    expect(document.querySelector('[data-leaderboard-empty]')?.textContent).toContain(
      '<img src=x onerror=alert(1)>',
    );
    expect(document.querySelector('[data-leaderboard-empty] img')).toBeNull();
  });

  it('暱稱必填且最多 12 字，可回報已儲存、未進榜與儲存失敗', async () => {
    const onScoreSubmit = vi.fn();
    const onRestart = vi.fn();
    const onHome = vi.fn();
    const writeText = mockClipboard();
    ui = new GameUI({ root: '#app', callbacks: { onScoreSubmit, onRestart, onHome } });
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
    const shareButton = document.querySelector<HTMLButtonElement>('[data-share-button]');
    const restartButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="restart-button"]',
    );
    const homeButton = document.querySelector<HTMLButtonElement>('[data-home-button]');
    expect(input?.maxLength).toBe(12);
    expect(submit?.textContent?.trim()).toBe('送出並記錄');
    expect(status?.textContent).toContain('成績不會自動上傳');
    expect(status?.textContent).toContain('請輸入暱稱並按「送出並記錄」');

    submit?.click();
    expect(onScoreSubmit).not.toHaveBeenCalled();
    expect(input?.getAttribute('aria-invalid')).toBe('true');

    if (input) input.value = '  abcdefghijklmnop  ';
    submit?.click();
    expect(onScoreSubmit).toHaveBeenCalledWith('abcdefghijkl');
    expect(input?.disabled).toBe(true);
    expect(status?.textContent).toContain('完成前請留在此頁');
    expect(restartButton?.disabled).toBe(true);
    expect(homeButton?.disabled).toBe(true);
    expect(shareButton?.disabled).toBe(true);
    restartButton?.click();
    homeButton?.click();
    expect(onRestart).not.toHaveBeenCalled();
    expect(onHome).not.toHaveBeenCalled();

    ui.setScoreSaved(3, '<b>跑者</b>');
    expect(status?.textContent).toContain('第 3 名');
    expect(document.querySelector('[data-score-form] b')).toBeNull();
    expect(restartButton?.disabled).toBe(false);
    expect(homeButton?.disabled).toBe(false);
    shareButton?.click();
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('排行榜第 3 名')),
    );
    await vi.waitFor(() => expect(shareButton?.disabled).toBe(false));

    ui.resetScoreSubmission();
    expect(input?.value).toBe('');
    expect(input?.disabled).toBe(false);
    expect(submit?.disabled).toBe(false);
    expect(submit?.textContent).toBe('送出並記錄');
    expect(status?.textContent).toContain('成績不會自動上傳');

    if (input) input.value = '重試者';
    submit?.click();
    ui.setScoreSaveError('<b>寫入失敗</b>');
    expect(input?.disabled).toBe(false);
    expect(submit?.disabled).toBe(false);
    expect(submit?.textContent).toBe('重新儲存');
    expect(restartButton?.disabled).toBe(false);
    expect(homeButton?.disabled).toBe(false);
    expect(status?.textContent).toBe('<b>寫入失敗</b>');
    expect(document.querySelector('[data-score-save-status] b')).toBeNull();

    ui.setScoreSaved(null, '未進榜跑者');
    expect(submit?.textContent).toBe('已送出');
    expect(submit?.disabled).toBe(true);
    expect(status?.textContent).toBe('成績已通過驗證並儲存，但目前未進入前 10 名。');
    writeText.mockClear();
    shareButton?.click();
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('成績已驗證・目前未進前 10 名'),
      ),
    );
  });

  it('排行榜名次在 Canvas 產生期間更新時，分享會等待並使用最新版內容', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    const context = createShareCanvasContextStub();
    const blobCallbacks: BlobCallback[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      blobCallbacks.push(callback);
    });
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: ShareData) => Boolean(data.files?.length),
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    ui = new GameUI({ root: '#app' });
    ui.showGameOver({
      distanceMeters: 42_195,
      score: 8_000,
      highScore: 8_000,
      failureReason: '完成三關',
      educationMessage: '穩定前進。',
      educationAction: '保留恢復時間。',
      outcome: 'completed',
      stageNumber: 3,
      stageName: '正式比賽',
    });

    document.querySelector<HTMLButtonElement>('[data-share-button]')?.click();
    ui.setScoreSaved(2, '名次跑者');
    expect(blobCallbacks).toHaveLength(2);

    blobCallbacks[0]?.(new Blob(['old'], { type: 'image/png' }));
    await Promise.resolve();
    expect(share).not.toHaveBeenCalled();
    blobCallbacks[1]?.(new Blob(['latest'], { type: 'image/png' }));

    await vi.waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(share.mock.calls[0]?.[0]).toMatchObject({
      text: expect.stringContaining('排行榜第 2 名'),
      files: [expect.any(File)],
    });
  });
});

function createShareCanvasContextStub(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
  return {
    createLinearGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 24 }) as TextMetrics),
  } as unknown as CanvasRenderingContext2D;
}
