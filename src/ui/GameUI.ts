import {
  DEFAULT_HUD_STATE,
  type GameOverSummary,
  type GameUICallbacks,
  type GameUIOptions,
  type GameUIView,
  type HUDState,
  type HUDStatus,
  type LeaderboardRow,
  type ShareMethod,
} from './types';
import { buildShareText, createShareCardFile, type ShareCardInput } from './shareCard';

const UI_MARKUP = `
  <div class="app-shell">
    <main class="game-main" aria-label="馬拉松完賽訓練">
      <div class="game-frame" data-view="home">
        <div
          id="game-container"
          class="game-container"
          data-testid="game-stage"
          aria-label="馬拉松完賽訓練遊戲畫面"
        ></div>

        <div class="ambient-sky" aria-hidden="true">
          <span class="ambient-cloud ambient-cloud--one"></span>
          <span class="ambient-cloud ambient-cloud--two"></span>
          <span class="ambient-track"></span>
        </div>

        <section class="home-screen screen-panel" data-testid="home-screen">
          <div class="home-card">
            <p class="eyebrow">三階段 × 健康備賽</p>
            <div class="runner-mark" aria-hidden="true">🏃</div>
            <h1>馬拉松完賽訓練</h1>
            <p class="home-lead">循序累積、聰明恢復、一路跑完正式比賽</p>

            <div class="marathon-route" aria-labelledby="route-title">
              <h2 id="route-title">三關備賽路線</h2>
              <ol class="stage-roadmap">
                <li>
                  <span class="stage-roadmap__number" aria-hidden="true">1</span>
                  <span><strong>基礎期</strong><small>穩定習慣與體力</small></span>
                </li>
                <li>
                  <span class="stage-roadmap__number" aria-hidden="true">2</span>
                  <span><strong>進階期</strong><small>增加訓練也顧恢復</small></span>
                </li>
                <li>
                  <span class="stage-roadmap__number" aria-hidden="true">3</span>
                  <span><strong>正式比賽</strong><small>守住配速安全完賽</small></span>
                </li>
              </ol>
              <p class="route-flow" aria-label="基礎期接著進階期，最後進入正式比賽">
                基礎期 <span aria-hidden="true">→</span> 進階期 <span aria-hidden="true">→</span>
                正式比賽
              </p>
            </div>

            <div class="how-to-play" aria-labelledby="how-to-title">
              <h2 id="how-to-title">怎麼玩</h2>
              <ol>
                <li><span aria-hidden="true">1</span>點畫面、右下跳躍鍵、空白鍵或↑跳躍</li>
                <li><span aria-hidden="true">2</span>跳過障礙，收集恢復道具</li>
                <li><span aria-hidden="true">3</span>守住體力與配速，完成三個階段</li>
              </ol>
            </div>

            <div class="home-actions">
              <button class="button button--primary button--large" data-testid="start-button" type="button">
                <span aria-hidden="true">▶</span>
                開始備賽
              </button>
              <button
                class="button button--secondary button--large"
                data-leaderboard-open
                data-testid="leaderboard-home-button"
                type="button"
              >
                <span aria-hidden="true">🏆</span>
                跨裝置排行榜
              </button>
            </div>
            <p class="home-hint">每一關都會更快；量力而為，完賽比硬撐重要。</p>
          </div>
        </section>

        <section class="hud-layer" aria-label="遊戲狀態" hidden>
          <div class="hud-top-actions">
            <button
              class="icon-button"
              data-testid="pause-button"
              type="button"
              aria-label="暫停遊戲"
            >
              <span aria-hidden="true">⏸</span>
              <span>暫停</span>
            </button>
            <button
              class="icon-button"
              data-testid="sound-toggle"
              type="button"
              aria-label="關閉聲音"
              aria-pressed="true"
            >
              <span data-sound-icon aria-hidden="true">🔊</span>
              <span data-sound-label>聲音：開</span>
            </button>
          </div>

          <section class="stage-hud" aria-label="馬拉松備賽進度">
            <div class="stage-hud__heading">
              <div>
                <span class="stage-hud__kicker" data-stage-counter>第 1 關／共 3 關</span>
                <strong data-stage-name>基礎期</strong>
              </div>
              <span class="pace-state" data-pace-state data-tone="comfortable">
                <span aria-hidden="true">●</span>
                配速狀態：舒適起跑
              </span>
            </div>

            <ol class="stage-indicator" aria-label="三關進度">
              <li data-stage-step="1" data-state="current" aria-current="step">
                <span aria-hidden="true">1</span><small>基礎</small>
              </li>
              <li data-stage-step="2" data-state="upcoming">
                <span aria-hidden="true">2</span><small>進階</small>
              </li>
              <li data-stage-step="3" data-state="upcoming">
                <span aria-hidden="true">3</span><small>比賽</small>
              </li>
            </ol>

            <div
              class="course-progress"
              data-course-progress
              role="progressbar"
              aria-label="馬拉松備賽全程進度"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="0"
            >
              <div class="course-progress__label">
                <span>全程進度</span>
                <strong data-progress-value>0%</strong>
              </div>
              <div class="course-progress__track" aria-hidden="true">
                <span data-progress-fill></span>
              </div>
            </div>
          </section>

          <div class="hud-summary">
            <div class="metric-card">
              <span class="metric-label">旅程里程</span>
              <strong data-distance>0 公尺</strong>
            </div>
            <div class="metric-card metric-card--score">
              <span class="metric-label">分數</span>
              <strong data-score>0</strong>
            </div>
            <div class="metric-card metric-card--speed">
              <span class="metric-label">速度／難度</span>
              <strong data-speed>300 · Lv.1</strong>
              <small data-difficulty-label>起步</small>
            </div>
          </div>

          <div class="vitals-card">
            <div class="vital" data-energy-meter role="meter" aria-label="體力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
              <div class="vital-heading">
                <span><span aria-hidden="true">⚡</span> 體力</span>
                <strong data-energy-value>100 / 100</strong>
              </div>
              <div class="bar-track" aria-hidden="true">
                <span class="bar-fill bar-fill--energy" data-energy-fill></span>
              </div>
            </div>

            <div class="vital" data-risk-meter role="meter" aria-label="受傷風險" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div class="vital-heading">
                <span><span aria-hidden="true">⚠️</span> 受傷風險</span>
                <strong data-risk-value>0 / 100</strong>
              </div>
              <div class="bar-track" aria-hidden="true">
                <span class="bar-fill bar-fill--risk" data-risk-fill></span>
              </div>
            </div>
          </div>

          <div class="status-region" data-status-region data-active="false" aria-live="polite">
            <span class="status-region__label">特殊狀態</span>
            <ul class="status-list" data-status-list>
              <li class="status-chip status-chip--neutral">狀態良好</li>
            </ul>
          </div>

          <div
            class="game-feedback"
            data-testid="game-feedback"
            data-game-feedback
            data-tone="positive"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          ></div>

          <button
            class="jump-button"
            data-testid="jump-button"
            type="button"
            aria-label="跳躍"
          >
            <span class="jump-button__icon" aria-hidden="true">↑</span>
            <span>跳躍</span>
          </button>
        </section>

        <section
          class="pause-overlay overlay-panel"
          data-testid="pause-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          hidden
        >
          <div class="overlay-card overlay-card--compact">
            <span class="overlay-icon" aria-hidden="true">⏸</span>
            <h2 id="pause-title">已暫停</h2>
            <p>喘口氣，準備好再繼續。</p>
            <button class="button button--primary button--large" data-testid="resume-button" type="button">
              <span aria-hidden="true">▶</span>
              繼續跑步
            </button>
          </div>
        </section>

        <section
          class="game-over-screen overlay-panel"
          data-testid="game-over-screen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
          aria-describedby="game-over-reason game-over-education game-over-action"
          tabindex="-1"
          hidden
        >
          <div class="overlay-card result-card">
            <p class="eyebrow" data-result-eyebrow>本次備賽紀錄</p>
            <h2 id="game-over-title" data-result-title>本次備賽中止</h2>
            <div class="outcome-banner" data-outcome-banner>
              <span class="outcome-banner__icon" data-outcome-icon aria-hidden="true">⏸</span>
              <span>
                <small data-outcome-label>本次抵達</small>
                <strong data-result-stage>第 1 關・基礎期</strong>
              </span>
            </div>
            <p class="new-record" data-new-record hidden>🏆 新紀錄！</p>

            <dl class="result-grid">
              <div>
                <dt>旅程里程</dt>
                <dd data-result-distance>0 公尺</dd>
              </div>
              <div>
                <dt>本次分數</dt>
                <dd data-result-score>0</dd>
              </div>
              <div>
                <dt>歷史最高分</dt>
                <dd data-high-score>0</dd>
              </div>
            </dl>

            <form class="score-save-form" data-score-form novalidate>
              <div class="score-save-form__heading">
                <label for="leaderboard-name">把本次成績送上跨裝置排行榜</label>
                <span>最多 12 字</span>
              </div>
              <div class="score-save-form__controls">
                <input
                  id="leaderboard-name"
                  data-score-name
                  type="text"
                  maxlength="12"
                  autocomplete="nickname"
                  enterkeyhint="done"
                  placeholder="輸入暱稱"
                  aria-describedby="score-save-status"
                />
                <button class="button button--save" data-score-submit type="submit">
                  送出驗證
                </button>
              </div>
              <p id="score-save-status" class="score-save-status" data-score-save-status aria-live="polite"></p>
            </form>

            <div class="failure-box" data-result-reason-box>
              <span data-reason-label>中途停止原因</span>
              <strong id="game-over-reason" data-failure-reason>體力耗盡</strong>
            </div>

            <blockquote
              id="game-over-education"
              class="education-message"
              data-education-message
            >
              休息不是偷懶，而是訓練計畫的一部分。
            </blockquote>

            <div class="education-action">
              <span>下次可以</span>
              <p id="game-over-action" data-education-action>把恢復日直接寫進訓練課表。</p>
            </div>

            <div class="result-actions">
              <button class="button button--primary" data-testid="restart-button" type="button">
                <span aria-hidden="true">↻</span>
                <span data-restart-label>調整策略再挑戰</span>
              </button>
              <button class="button button--secondary" data-share-button type="button">
                <span aria-hidden="true">↗</span>
                分享成績
              </button>
              <button
                class="button button--secondary"
                data-leaderboard-open
                data-testid="leaderboard-result-button"
                type="button"
              >
                <span aria-hidden="true">🏆</span>
                查看排行榜
              </button>
              <button class="button button--ghost" data-home-button type="button">
                回到首頁
              </button>
            </div>
            <p class="share-status" data-share-status aria-live="polite"></p>
          </div>
        </section>

        <section
          class="leaderboard-overlay overlay-panel"
          data-testid="leaderboard-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leaderboard-title"
          aria-describedby="leaderboard-device-note"
          tabindex="-1"
          hidden
        >
          <div class="overlay-card leaderboard-card">
            <div class="leaderboard-header">
              <div>
                <p class="eyebrow">TOP 10</p>
                <h2 id="leaderboard-title">跨裝置排行榜</h2>
              </div>
              <button
                class="leaderboard-close"
                data-leaderboard-close
                type="button"
                aria-label="關閉排行榜"
              >
                關閉
              </button>
            </div>

            <p id="leaderboard-device-note" class="leaderboard-device-note">
              <span aria-hidden="true">☁️</span>
              只顯示通過伺服器規則檢查的成績；暱稱請勿填入真實姓名或敏感資訊。
            </p>

            <div class="leaderboard-scroll" data-leaderboard-table hidden>
              <table class="leaderboard-table">
                <thead>
                  <tr>
                    <th scope="col">排名</th>
                    <th scope="col">暱稱</th>
                    <th scope="col">分數</th>
                    <th scope="col">里程</th>
                    <th scope="col">結果</th>
                  </tr>
                </thead>
                <tbody data-leaderboard-body></tbody>
              </table>
            </div>

            <div class="leaderboard-empty" data-leaderboard-empty data-state="empty">
              <span data-leaderboard-empty-icon aria-hidden="true">🏃</span>
              <strong data-leaderboard-empty-title>還沒有網路成績</strong>
              <p data-leaderboard-empty-message>完成一局並輸入暱稱，就能成為第一位上榜跑者。</p>
            </div>
          </div>
        </section>
      </div>
    </main>

    <footer class="medical-disclaimer">
      <span aria-hidden="true">ℹ️</span>
      本遊戲僅供娛樂與衛教，不取代醫療診斷、個別評估或正式備賽計畫。
    </footer>
  </div>
`;

const numberFormatter = new Intl.NumberFormat('zh-TW', {
  maximumFractionDigits: 0,
});

const MARATHON_STAGE_NAMES = ['基礎期', '進階期', '正式比賽'] as const;
const DEFAULT_STAGE_COUNT = MARATHON_STAGE_NAMES.length;

const noopCallbacks: GameUICallbacks = {
  onStart: () => undefined,
  onJump: () => undefined,
  onPause: () => undefined,
  onResume: () => undefined,
  onRestart: () => undefined,
  onHome: () => undefined,
  onSoundChange: () => undefined,
  onLeaderboardOpen: () => undefined,
  onScoreSubmit: () => undefined,
  onShare: () => undefined,
};

export class GameUI {
  private readonly root: HTMLElement;
  private readonly eventController = new AbortController();
  private callbacks: GameUICallbacks;
  private hudState: HUDState = { ...DEFAULT_HUD_STATE, statuses: [] };
  private view: GameUIView = 'home';
  private soundEnabled: boolean;
  private shareText = '';
  private shareCardInput: ShareCardInput | null = null;
  private shareCardFilePromise: Promise<File | null> | null = null;
  private renderedStatusSignature = '';
  private feedbackTimerId: number | null = null;

  private readonly frame: HTMLElement;
  private readonly homeScreen: HTMLElement;
  private readonly hudLayer: HTMLElement;
  private readonly pauseOverlay: HTMLElement;
  private readonly gameOverScreen: HTMLElement;
  private readonly leaderboardModal: HTMLElement;
  private readonly gameContainer: HTMLElement;
  private readonly medicalDisclaimer: HTMLElement;
  private leaderboardReturnFocus: HTMLElement | null = null;

  constructor(options: GameUIOptions) {
    const root =
      typeof options.root === 'string'
        ? document.querySelector<HTMLElement>(options.root)
        : options.root;

    if (!root) {
      throw new Error(`GameUI root not found: ${String(options.root)}`);
    }

    this.root = root;
    this.callbacks = { ...noopCallbacks, ...options.callbacks };
    this.soundEnabled = options.initialSoundEnabled ?? true;
    this.root.innerHTML = UI_MARKUP;

    this.frame = this.element('.game-frame');
    this.homeScreen = this.element('[data-testid="home-screen"]');
    this.hudLayer = this.element('.hud-layer');
    this.pauseOverlay = this.element('[data-testid="pause-overlay"]');
    this.gameOverScreen = this.element('[data-testid="game-over-screen"]');
    this.leaderboardModal = this.element('[data-testid="leaderboard-modal"]');
    this.gameContainer = this.element('#game-container');
    this.medicalDisclaimer = this.element('.medical-disclaimer');

    this.bindControls();
    this.updateHUD(DEFAULT_HUD_STATE);
    this.setSoundEnabled(this.soundEnabled, false);
    this.showHome();
  }

  /** Phaser should be configured with this element (or its id) as parent. */
  getGameContainer(): HTMLElement {
    return this.gameContainer;
  }

  getView(): GameUIView {
    return this.view;
  }

  isLeaderboardOpen(): boolean {
    return !this.leaderboardModal.hidden;
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  setCallbacks(callbacks: Partial<GameUICallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  setStartEnabled(enabled: boolean): void {
    const button = this.element<HTMLButtonElement>('[data-testid="start-button"]');
    button.disabled = !enabled;
    button.setAttribute('aria-busy', String(!enabled));
    if (enabled && this.view === 'home') button.focus();
  }

  showHome(): void {
    this.setView('home');
  }

  showPlaying(): void {
    this.setView('playing');
  }

  setPaused(paused: boolean): void {
    this.setView(paused ? 'paused' : 'playing');
  }

  resetHUD(state: Partial<HUDState> = {}): void {
    this.hudState = {
      ...DEFAULT_HUD_STATE,
      ...state,
      statuses: state.statuses ? [...state.statuses] : [],
    };
    this.clearFeedback();
    this.renderHUD();
  }

  updateHUD(update: Partial<HUDState>): void {
    this.hudState = {
      ...this.hudState,
      ...update,
      statuses: update.statuses ? [...update.statuses] : this.hudState.statuses,
    };
    this.renderHUD();
  }

  setSoundEnabled(enabled: boolean, notify = true): void {
    this.soundEnabled = enabled;

    const button = this.element<HTMLButtonElement>('[data-testid="sound-toggle"]');
    const icon = this.element<HTMLElement>('[data-sound-icon]');
    const label = this.element<HTMLElement>('[data-sound-label]');
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? '關閉聲音' : '開啟聲音');
    icon.textContent = enabled ? '🔊' : '🔇';
    label.textContent = enabled ? '聲音：開' : '聲音：關';

    if (notify) {
      this.callbacks.onSoundChange(enabled);
    }
  }

  showFeedback(text: string, tone: 'positive' | 'danger', durationMs = 1_400): void {
    const feedback = this.element<HTMLElement>('[data-game-feedback]');
    const normalizedText = text.trim();
    if (!normalizedText) {
      this.clearFeedback();
      return;
    }

    const normalizedDuration = Number.isFinite(durationMs)
      ? this.clamp(Math.round(durationMs), 600, 3_000)
      : 1_400;
    if (this.feedbackTimerId !== null) {
      window.clearTimeout(this.feedbackTimerId);
      this.feedbackTimerId = null;
    }
    feedback.classList.remove('game-feedback--visible');
    feedback.textContent = normalizedText;
    feedback.dataset.tone = tone;
    feedback.style.setProperty('--feedback-duration', `${normalizedDuration}ms`);
    void feedback.offsetWidth;
    feedback.classList.add('game-feedback--visible');
    this.feedbackTimerId = window.setTimeout(() => this.clearFeedback(), normalizedDuration);
  }

  showGameOver(summary: GameOverSummary): void {
    this.resetScoreSubmission();
    const outcome = summary.outcome ?? 'stopped';
    const totalStages = this.normalizePositiveInteger(summary.totalStages, DEFAULT_STAGE_COUNT);
    const defaultStageNumber = outcome === 'completed' ? totalStages : 1;
    const stageNumber = this.clamp(
      this.normalizePositiveInteger(summary.stageNumber, defaultStageNumber),
      1,
      totalStages,
    );
    const stageName =
      summary.stageName?.trim() || MARATHON_STAGE_NAMES[stageNumber - 1] || `第 ${stageNumber} 關`;

    this.shareCardInput = {
      distanceMeters: summary.distanceMeters,
      score: summary.score,
      outcome,
      stageNumber,
      totalStages,
      stageName,
    };
    this.shareText = summary.shareText?.trim() || buildShareText(this.shareCardInput);
    this.shareCardFilePromise = this.prepareShareCardFile(this.shareCardInput);
    this.gameOverScreen.dataset.outcome = outcome;
    this.element<HTMLElement>('[data-outcome-banner]').dataset.outcome = outcome;
    this.element<HTMLElement>('[data-result-reason-box]').dataset.outcome = outcome;
    this.text('[data-result-eyebrow]', outcome === 'completed' ? '三階段挑戰完成' : '本次備賽紀錄');
    this.text('[data-result-title]', outcome === 'completed' ? '恭喜順利完賽！' : '本次備賽中止');
    this.text('[data-outcome-icon]', outcome === 'completed' ? '🏁' : '⏸');
    this.text('[data-outcome-label]', outcome === 'completed' ? '完成路線' : '本次抵達');
    this.text('[data-result-stage]', `第 ${stageNumber} 關・${stageName}`);
    this.text('[data-reason-label]', outcome === 'completed' ? '完賽成果' : '中途停止原因');
    this.text('[data-restart-label]', outcome === 'completed' ? '再次挑戰三關' : '調整策略再挑戰');
    this.text('[data-result-distance]', this.formatDistance(summary.distanceMeters));
    this.text('[data-result-score]', this.formatNumber(summary.score));
    this.text('[data-high-score]', this.formatNumber(summary.highScore));
    this.text('[data-failure-reason]', summary.failureReason);
    this.text('[data-education-message]', summary.educationMessage);
    this.text('[data-education-action]', summary.educationAction);
    this.text('[data-share-status]', '');
    this.element('[data-new-record]').hidden = !summary.isNewHighScore;
    this.setView('game-over');
  }

  setSharePlayerName(name: string): void {
    if (this.shareCardInput === null) return;

    this.shareCardInput = { ...this.shareCardInput, nickname: name };
    this.shareText = buildShareText(this.shareCardInput);
    this.shareCardFilePromise = this.prepareShareCardFile(this.shareCardInput);
  }

  /** 顯示控制層已排序資料的前 10 筆；所有動態文字均以 textContent 寫入。 */
  showLeaderboard(rows: readonly LeaderboardRow[], currentId?: string): void {
    const body = this.element<HTMLTableSectionElement>('[data-leaderboard-body]');
    const table = this.element<HTMLElement>('[data-leaderboard-table]');
    const empty = this.element<HTMLElement>('[data-leaderboard-empty]');
    const visibleRows = rows.slice(0, 10);
    body.replaceChildren();

    visibleRows.forEach((entry, index) => {
      const row = document.createElement('tr');
      const isCurrent = currentId !== undefined && entry.id === currentId;
      row.dataset.current = String(isCurrent);
      if (isCurrent) row.setAttribute('aria-current', 'true');

      this.appendLeaderboardCell(row, `#${index + 1}`, 'leaderboard-rank');

      const nameCell = document.createElement('td');
      nameCell.className = 'leaderboard-name';
      const name = document.createElement('span');
      const normalizedName = typeof entry.name === 'string' ? entry.name.trim() : '';
      name.textContent = normalizedName || '匿名跑者';
      nameCell.append(name);
      if (isCurrent) {
        const currentBadge = document.createElement('small');
        currentBadge.className = 'leaderboard-current-badge';
        currentBadge.textContent = '你';
        nameCell.append(currentBadge);
      }
      row.append(nameCell);

      this.appendLeaderboardCell(row, this.formatNumber(entry.score), 'leaderboard-score');
      this.appendLeaderboardCell(
        row,
        this.formatDistance(entry.distanceMeters),
        'leaderboard-distance',
      );

      const outcomeCell = document.createElement('td');
      const outcomeBadge = document.createElement('span');
      const completed = entry.outcome === 'completed';
      outcomeBadge.className = 'leaderboard-outcome';
      outcomeBadge.dataset.outcome = completed ? 'completed' : 'stopped';
      outcomeBadge.textContent = completed ? '完賽' : '停止';
      outcomeCell.append(outcomeBadge);
      row.append(outcomeCell);

      body.append(row);
    });

    table.hidden = visibleRows.length === 0;
    empty.hidden = visibleRows.length > 0;
    empty.dataset.state = 'empty';
    this.text('[data-leaderboard-empty-icon]', '🏃');
    this.text('[data-leaderboard-empty-title]', '還沒有網路成績');
    this.text('[data-leaderboard-empty-message]', '完成一局並輸入暱稱，就能成為第一位上榜跑者。');
    this.openLeaderboard(false);
  }

  setLeaderboardLoading(): void {
    const body = this.element<HTMLTableSectionElement>('[data-leaderboard-body]');
    const table = this.element<HTMLElement>('[data-leaderboard-table]');
    const empty = this.element<HTMLElement>('[data-leaderboard-empty]');

    body.replaceChildren();
    table.hidden = true;
    empty.hidden = false;
    empty.dataset.state = 'loading';
    this.text('[data-leaderboard-empty-icon]', '☁️');
    this.text('[data-leaderboard-empty-title]', '正在同步排行榜');
    this.text('[data-leaderboard-empty-message]', '正在讀取各裝置通過驗證的最新成績…');
  }

  setLeaderboardError(message: string): void {
    const body = this.element<HTMLTableSectionElement>('[data-leaderboard-body]');
    const table = this.element<HTMLElement>('[data-leaderboard-table]');
    const empty = this.element<HTMLElement>('[data-leaderboard-empty]');

    body.replaceChildren();
    table.hidden = true;
    empty.hidden = false;
    empty.dataset.state = 'error';
    this.text('[data-leaderboard-empty-icon]', '📡');
    this.text('[data-leaderboard-empty-title]', '暫時無法同步');
    this.text(
      '[data-leaderboard-empty-message]',
      message.trim() || '請檢查網路後關閉視窗再試一次。',
    );
  }

  setScoreSaved(rank: number | null, name: string): void {
    const input = this.element<HTMLInputElement>('[data-score-name]');
    const button = this.element<HTMLButtonElement>('[data-score-submit]');
    const status = this.element<HTMLElement>('[data-score-save-status]');
    const safeName = name.trim().slice(0, 12) || '匿名跑者';
    const safeRank = rank === null ? 0 : this.normalizePositiveInteger(rank, 0);

    input.value = safeName;
    input.disabled = true;
    input.removeAttribute('aria-invalid');
    button.disabled = true;
    button.textContent = safeRank > 0 ? '已驗證' : '已送出';
    status.dataset.state = safeRank > 0 ? 'saved' : 'not-ranked';
    status.textContent =
      safeRank > 0
        ? `已通過伺服器驗證！${safeName} 目前是第 ${safeRank} 名。`
        : '成績已通過驗證並儲存，但目前未進入前 10 名。';
  }

  setScoreSaveError(message: string): void {
    const input = this.element<HTMLInputElement>('[data-score-name]');
    const button = this.element<HTMLButtonElement>('[data-score-submit]');
    const status = this.element<HTMLElement>('[data-score-save-status]');

    input.disabled = false;
    button.disabled = false;
    button.textContent = '重新儲存';
    status.dataset.state = 'error';
    status.textContent = message.trim() || '成績儲存失敗，請再試一次。';
    input.focus({ preventScroll: true });
  }

  resetScoreSubmission(): void {
    const form = this.element<HTMLFormElement>('[data-score-form]');
    const input = this.element<HTMLInputElement>('[data-score-name]');
    const button = this.element<HTMLButtonElement>('[data-score-submit]');
    const status = this.element<HTMLElement>('[data-score-save-status]');

    form.reset();
    input.disabled = false;
    input.removeAttribute('aria-invalid');
    button.disabled = false;
    button.textContent = '送出驗證';
    status.removeAttribute('data-state');
    status.textContent = '';
  }

  destroy(): void {
    this.eventController.abort();
    this.clearFeedback();
    this.root.replaceChildren();
  }

  private bindControls(): void {
    const signal = this.eventController.signal;

    this.element<HTMLButtonElement>('[data-testid="start-button"]').addEventListener(
      'click',
      () => {
        this.showPlaying();
        this.callbacks.onStart();
      },
      { signal },
    );

    this.element<HTMLButtonElement>('[data-testid="jump-button"]').addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        this.callbacks.onJump();
        this.focusGameCanvas();
      },
      { signal },
    );

    this.element<HTMLButtonElement>('[data-testid="jump-button"]').addEventListener(
      'click',
      (event) => {
        if (event.detail === 0) this.callbacks.onJump();
      },
      { signal },
    );

    this.element<HTMLButtonElement>('[data-testid="jump-button"]').addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'ArrowUp') return;
        event.preventDefault();
        this.callbacks.onJump();
      },
      { signal },
    );

    this.element<HTMLButtonElement>('[data-testid="pause-button"]').addEventListener(
      'click',
      () => {
        this.setPaused(true);
        this.callbacks.onPause();
      },
      { signal },
    );

    this.element<HTMLButtonElement>('[data-testid="resume-button"]').addEventListener(
      'click',
      () => {
        this.setPaused(false);
        this.callbacks.onResume();
      },
      { signal },
    );

    this.element<HTMLButtonElement>('[data-testid="restart-button"]').addEventListener(
      'click',
      () => {
        this.showPlaying();
        this.callbacks.onRestart();
      },
      { signal },
    );

    this.element<HTMLButtonElement>('[data-home-button]').addEventListener(
      'click',
      () => {
        this.showHome();
        this.callbacks.onHome();
      },
      { signal },
    );

    this.element<HTMLButtonElement>('[data-testid="sound-toggle"]').addEventListener(
      'click',
      (event) => {
        this.setSoundEnabled(!this.soundEnabled);
        if (event.detail > 0) this.focusGameCanvas();
      },
      { signal },
    );

    this.element<HTMLButtonElement>('[data-share-button]').addEventListener(
      'click',
      () => void this.shareResult(),
      { signal },
    );

    this.root.querySelectorAll<HTMLButtonElement>('[data-leaderboard-open]').forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          this.openLeaderboard(true);
        },
        { signal },
      );
    });

    this.element<HTMLButtonElement>('[data-leaderboard-close]').addEventListener(
      'click',
      () => this.closeLeaderboard(),
      { signal },
    );

    this.element<HTMLFormElement>('[data-score-form]').addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        const input = this.element<HTMLInputElement>('[data-score-name]');
        const button = this.element<HTMLButtonElement>('[data-score-submit]');
        const status = this.element<HTMLElement>('[data-score-save-status]');
        const name = input.value.trim().slice(0, 12);

        if (!name) {
          input.setAttribute('aria-invalid', 'true');
          status.dataset.state = 'error';
          status.textContent = '請輸入 1～12 字的暱稱。';
          input.focus();
          return;
        }

        input.value = name;
        input.disabled = true;
        input.removeAttribute('aria-invalid');
        button.disabled = true;
        status.dataset.state = 'pending';
        status.textContent = '正在驗證與儲存本次成績…';
        this.callbacks.onScoreSubmit(name);
      },
      { signal },
    );

    this.element<HTMLInputElement>('[data-score-name]').addEventListener(
      'input',
      (event) => {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement) || input.getAttribute('aria-invalid') !== 'true') {
          return;
        }
        input.removeAttribute('aria-invalid');
        const status = this.element<HTMLElement>('[data-score-save-status]');
        status.removeAttribute('data-state');
        status.textContent = '';
      },
      { signal },
    );

    this.root.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && !this.leaderboardModal.hidden) {
          event.preventDefault();
          this.closeLeaderboard();
        }
      },
      { signal },
    );
  }

  private setView(view: GameUIView): void {
    this.view = view;
    this.frame.dataset.view = view;
    this.homeScreen.hidden = view !== 'home';
    this.hudLayer.hidden = view === 'home';
    this.pauseOverlay.hidden = view !== 'paused';
    this.gameOverScreen.hidden = view !== 'game-over';

    this.syncInertState();
    this.hudLayer.setAttribute('aria-hidden', String(view !== 'playing'));
    this.gameContainer.setAttribute('aria-hidden', String(view !== 'playing'));

    if (view === 'home') {
      this.element<HTMLButtonElement>('[data-testid="start-button"]').focus();
    } else if (view === 'paused') {
      this.element<HTMLButtonElement>('[data-testid="resume-button"]').focus();
    } else if (view === 'game-over') {
      this.element<HTMLElement>('.result-card').scrollTop = 0;
      this.gameOverScreen.focus({ preventScroll: true });
    } else if (view === 'playing') {
      this.focusGameCanvas();
    }
  }

  private focusGameCanvas(): void {
    queueMicrotask(() => {
      this.gameContainer.querySelector<HTMLCanvasElement>('canvas')?.focus({
        preventScroll: true,
      });
    });
  }

  private openLeaderboard(notify: boolean): void {
    if (this.leaderboardModal.hidden) {
      const activeElement = document.activeElement;
      this.leaderboardReturnFocus =
        activeElement instanceof HTMLElement && this.root.contains(activeElement)
          ? activeElement
          : null;
      this.leaderboardModal.hidden = false;
      this.leaderboardModal.removeAttribute('aria-hidden');
      this.syncInertState();
      queueMicrotask(() => {
        this.element<HTMLButtonElement>('[data-leaderboard-close]').focus({
          preventScroll: true,
        });
      });
    }

    if (notify) this.callbacks.onLeaderboardOpen();
  }

  private closeLeaderboard(): void {
    if (this.leaderboardModal.hidden) return;

    const returnFocus = this.leaderboardReturnFocus;
    this.leaderboardReturnFocus = null;
    this.leaderboardModal.hidden = true;
    this.leaderboardModal.setAttribute('aria-hidden', 'true');
    this.syncInertState();

    if (returnFocus?.isConnected) {
      returnFocus.focus({ preventScroll: true });
    } else if (this.view === 'home') {
      this.element<HTMLButtonElement>('[data-testid="start-button"]').focus();
    } else if (this.view === 'game-over') {
      this.gameOverScreen.focus({ preventScroll: true });
    }
  }

  private syncInertState(): void {
    const leaderboardOpen = !this.leaderboardModal.hidden;
    const modalIsOpen = this.view === 'paused' || this.view === 'game-over' || leaderboardOpen;
    this.homeScreen.inert = leaderboardOpen || this.view !== 'home';
    this.hudLayer.inert = leaderboardOpen || this.view !== 'playing';
    this.gameContainer.inert = leaderboardOpen || this.view !== 'playing';
    this.pauseOverlay.inert = leaderboardOpen || this.view !== 'paused';
    this.gameOverScreen.inert = leaderboardOpen || this.view !== 'game-over';
    this.leaderboardModal.inert = !leaderboardOpen;
    this.medicalDisclaimer.inert = modalIsOpen;
  }

  private renderHUD(): void {
    const state = this.hudState;
    const maxEnergy = Math.max(1, state.maxEnergy);
    const maxRisk = Math.max(1, state.maxInjuryRisk);
    const energy = this.clamp(state.energy, 0, maxEnergy);
    const risk = this.clamp(state.injuryRisk, 0, maxRisk);
    const energyPercent = (energy / maxEnergy) * 100;
    const riskPercent = (risk / maxRisk) * 100;
    const totalStages = this.normalizePositiveInteger(state.totalStages, DEFAULT_STAGE_COUNT);
    const stageNumber = this.clamp(
      this.normalizePositiveInteger(state.stageNumber, 1),
      1,
      totalStages,
    );
    const stageName =
      state.stageName?.trim() || MARATHON_STAGE_NAMES[stageNumber - 1] || `第 ${stageNumber} 關`;
    const overallProgressPercent = this.clamp(state.overallProgressPercent ?? 0, 0, 100);
    const paceLabel = state.paceLabel?.trim() || '穩定前進';
    const paceTone = state.paceTone ?? 'steady';

    this.text('[data-distance]', this.formatDistance(state.distanceMeters));
    this.text('[data-score]', this.formatNumber(state.score));
    this.text(
      '[data-speed]',
      `${this.formatNumber(state.speed)} · Lv.${Math.max(1, Math.floor(state.difficultyLevel))}`,
    );
    this.text('[data-difficulty-label]', state.difficultyLabel ?? '');
    this.text('[data-stage-counter]', `第 ${stageNumber} 關／共 ${totalStages} 關`);
    this.text('[data-stage-name]', stageName);
    this.text('[data-pace-state]', `● 配速狀態：${paceLabel}`);
    this.text('[data-progress-value]', `${this.formatNumber(overallProgressPercent)}%`);
    this.text(
      '[data-energy-value]',
      `${this.formatNumber(energy)} / ${this.formatNumber(maxEnergy)}`,
    );
    this.text('[data-risk-value]', `${this.formatNumber(risk)} / ${this.formatNumber(maxRisk)}`);

    this.element<HTMLElement>('[data-energy-fill]').style.width = `${energyPercent}%`;
    this.element<HTMLElement>('[data-risk-fill]').style.width = `${riskPercent}%`;
    this.element<HTMLElement>('[data-progress-fill]').style.width = `${overallProgressPercent}%`;

    const stageHud = this.element<HTMLElement>('.stage-hud');
    stageHud.dataset.stage = String(stageNumber);

    const paceState = this.element<HTMLElement>('[data-pace-state]');
    paceState.dataset.tone = paceTone;

    const courseProgress = this.element<HTMLElement>('[data-course-progress]');
    courseProgress.setAttribute('aria-valuenow', String(Math.round(overallProgressPercent)));

    this.root.querySelectorAll<HTMLElement>('[data-stage-step]').forEach((step) => {
      const stepNumber = Number(step.dataset.stageStep);
      step.dataset.state =
        stepNumber < stageNumber
          ? 'completed'
          : stepNumber === stageNumber
            ? 'current'
            : 'upcoming';
      if (stepNumber === stageNumber) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });

    const energyMeter = this.element<HTMLElement>('[data-energy-meter]');
    energyMeter.setAttribute('aria-valuemax', String(maxEnergy));
    energyMeter.setAttribute('aria-valuenow', String(Math.round(energy)));
    energyMeter.dataset.level = energyPercent <= 25 ? 'critical' : 'normal';

    const riskMeter = this.element<HTMLElement>('[data-risk-meter]');
    riskMeter.setAttribute('aria-valuemax', String(maxRisk));
    riskMeter.setAttribute('aria-valuenow', String(Math.round(risk)));
    riskMeter.dataset.level =
      riskPercent >= 75 ? 'critical' : riskPercent >= 45 ? 'warning' : 'normal';

    this.renderStatuses(state.statuses);
  }

  private renderStatuses(statuses: HUDStatus[]): void {
    const region = this.element<HTMLElement>('[data-status-region]');
    region.dataset.active = String(statuses.length > 0);
    const signature =
      statuses.length === 0
        ? 'healthy'
        : statuses
            .map(
              (status) =>
                `${status.id}:${status.label}:${status.tone ?? 'neutral'}:${
                  typeof status.remainingSeconds === 'number'
                    ? Math.max(0, Math.ceil(status.remainingSeconds))
                    : ''
                }`,
            )
            .join('|');
    if (signature === this.renderedStatusSignature) return;
    this.renderedStatusSignature = signature;

    const list = this.element<HTMLUListElement>('[data-status-list]');
    list.replaceChildren();

    if (statuses.length === 0) {
      const item = document.createElement('li');
      item.className = 'status-chip status-chip--neutral';
      item.textContent = '狀態良好';
      list.append(item);
      return;
    }

    statuses.forEach((status) => {
      const item = document.createElement('li');
      item.className = `status-chip status-chip--${status.tone ?? 'neutral'}`;
      item.dataset.statusId = status.id;

      const label = [status.icon, status.label].filter(Boolean).join(' ');
      item.textContent =
        typeof status.remainingSeconds === 'number'
          ? `${label} ${Math.max(0, Math.ceil(status.remainingSeconds))} 秒`
          : label;
      list.append(item);
    });
  }

  private clearFeedback(): void {
    if (this.feedbackTimerId !== null) {
      window.clearTimeout(this.feedbackTimerId);
      this.feedbackTimerId = null;
    }
    const feedback = this.element<HTMLElement>('[data-game-feedback]');
    feedback.classList.remove('game-feedback--visible');
    feedback.textContent = '';
  }

  private async shareResult(): Promise<void> {
    const text = this.shareText.trim();
    const status = this.element<HTMLElement>('[data-share-status]');
    const button = this.element<HTMLButtonElement>('[data-share-button]');

    if (!text) {
      status.textContent = '目前沒有可分享的成績。';
      this.callbacks.onShare(text, 'unavailable');
      return;
    }

    button.disabled = true;
    let method: ShareMethod = 'unavailable';

    try {
      if (typeof navigator.share === 'function') {
        const file = await this.shareCardFilePromise;
        const textPayload: ShareData = { title: '馬拉松完賽訓練', text };
        const imagePayload: ShareData | null = file ? { ...textPayload, files: [file] } : null;
        let canShareImage = false;

        if (imagePayload && typeof navigator.canShare === 'function') {
          try {
            canShareImage = navigator.canShare(imagePayload);
          } catch {
            canShareImage = false;
          }
        }

        await navigator.share(canShareImage && imagePayload ? imagePayload : textPayload);
        method = 'web-share';
        status.textContent = canShareImage ? '成績卡已分享！' : '成績文字已分享！';
      } else if (await this.copyToClipboard(text)) {
        method = 'clipboard';
        status.textContent = '成績文字已複製！';
      } else {
        status.textContent = '無法自動複製，請手動複製成績。';
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        method = 'cancelled';
        status.textContent = '已取消分享。';
      } else if (await this.copyToClipboard(text)) {
        method = 'clipboard';
        status.textContent = '成績文字已複製！';
      } else {
        status.textContent = '分享失敗，請稍後再試。';
      }
    } finally {
      button.disabled = false;
      this.callbacks.onShare(text, method);
    }
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // A non-secure origin may reject Clipboard API; use the DOM fallback.
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.className = 'clipboard-helper';
    document.body.append(textArea);
    textArea.select();

    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      textArea.remove();
    }
  }

  private prepareShareCardFile(input: ShareCardInput): Promise<File | null> {
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      return Promise.resolve(null);
    }
    return createShareCardFile(input);
  }

  private text(selector: string, value: string): void {
    this.element<HTMLElement>(selector).textContent = value;
  }

  private appendLeaderboardCell(row: HTMLTableRowElement, value: string, className: string): void {
    const cell = document.createElement('td');
    cell.className = className;
    cell.textContent = value;
    row.append(cell);
  }

  private element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`GameUI element missing: ${selector}`);
    }
    return element;
  }

  private formatDistance(value: number): string {
    return `${this.formatNumber(value)} 公尺`;
  }

  private formatNumber(value: number): string {
    const safeValue = Number.isFinite(value) ? value : 0;
    return numberFormatter.format(Math.max(0, Math.round(safeValue)));
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    const safeValue = Number.isFinite(value) ? value : minimum;
    return Math.min(maximum, Math.max(minimum, safeValue));
  }

  private normalizePositiveInteger(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value as number) : fallback;
  }
}

export type {
  GameOverSummary,
  GameUICallbacks,
  GameUIOptions,
  GameUIView,
  HUDState,
  HUDStatus,
  LeaderboardRow,
  MarathonStageNumber,
  PaceTone,
  RunOutcome,
  ShareMethod,
  UiResult,
  UiSnapshot,
} from './types';
