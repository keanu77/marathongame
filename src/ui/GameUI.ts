import type {
  EducationReminderCard,
  EducationSafetyAlert,
  EducationTopic,
  RunKnowledgeItem,
} from '../shared/education';
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

const UI_ICONS = {
  energy: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M13.4 2.8 5.8 13h5.7l-.9 8.2L18.2 11h-5.7l.9-8.2Z" />
    </svg>
  `,
  jump: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M12 19V5m-5 5 5-5 5 5" />
      <path class="ui-icon__detail" d="M6 21h12" />
    </svg>
  `,
  leaderboard: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M8 4h8v3.5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H4.5v1.5A3.5 3.5 0 0 0 8 11m8-5h3.5v1.5A3.5 3.5 0 0 1 16 11M12 12v4m-3 4h6m-5-4h4" />
    </svg>
  `,
  pause: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M8 6v12M16 6v12" />
    </svg>
  `,
  play: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path class="ui-icon__fill" d="m8 5 11 7-11 7V5Z" />
    </svg>
  `,
  restart: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M5.2 8.2A8 8 0 1 1 4 15.8" />
      <path d="M4.8 3.8v4.8h4.8" />
    </svg>
  `,
  share: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M12 15V3m-4 4 4-4 4 4" />
      <path d="M6 11H4.5A1.5 1.5 0 0 0 3 12.5v6A1.5 1.5 0 0 0 4.5 20h15a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H18" />
    </svg>
  `,
  download: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3v12m-4-4 4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  `,
  close: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  `,
  risk: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17" r=".65" />
    </svg>
  `,
  sound: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path class="ui-icon__speaker" d="M4 9h4l5-4v14l-5-4H4V9Z" />
      <path class="ui-icon__sound-wave" d="M16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12" />
      <path class="ui-icon__sound-off" d="m16.5 9.5 5 5m0-5-5 5" />
    </svg>
  `,
  runner: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <circle cx="14.5" cy="4.2" r="2.2" />
      <path d="m12.7 7.2-3.4 4.2 3.2 2.2-2.7 6.1M13 8l3 3.3 3.1.8M12.5 13.6l3.8 2.2 2.2 4" />
      <path d="M10.1 8.1 7 8.7 5.2 11" />
    </svg>
  `,
  target: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <circle cx="11" cy="13" r="7" /><circle cx="11" cy="13" r="3" />
      <path d="m13.2 10.8 6.3-6.3m-3.2.2h3v3" />
    </svg>
  `,
  info: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7.2h.01" />
    </svg>
  `,
  recovery: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M9 4v10.1a4 4 0 1 0 6 0V4a3 3 0 0 0-6 0Z" />
      <path d="M12 7v8m-3 0h6" />
    </svg>
  `,
  shield: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3 5 6v5.2c0 4.5 2.8 7.6 7 9.8 4.2-2.2 7-5.3 7-9.8V6l-7-3Z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  `,
  zone2: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M20 8.8c0 5-8 10.2-8 10.2S4 13.8 4 8.8A4.1 4.1 0 0 1 11.2 6L12 7l.8-1A4.1 4.1 0 0 1 20 8.8Z" />
      <path d="M8 11h2l1-2 2 5 1-3h2" />
    </svg>
  `,
  route: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" />
      <path d="M7.5 16.7c4.5-2 7.5.2 9-2.4 1.1-1.9-1.7-2.7-3.7-3.6S10 8 11.5 6.5c1.2-1.2 2.7-.6 4.5-.5" />
    </svg>
  `,
  interval: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="13" r="7" /><path d="M12 13V8m-3-5h6m-3 0v3" />
      <path d="m15.5 9.5-3.5 3.5 3 2" />
    </svg>
  `,
  training: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M4 18V9m5 9V5m5 13v-7m5 7V3" />
      <path d="m3 12 5-4 5 3 7-6" />
    </svg>
  `,
  injury: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
      <path d="M9.5 8v2.5H7v3h2.5V16h3v-2.5H15v-3h-2.5V8h-3Z" />
    </svg>
  `,
  nutrition: `
    <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
      <path d="M7 9h10l-1 11H8L7 9Z" /><path d="M9 9V6h6v3M9.5 14h5" />
    </svg>
  `,
} as const;

function getStatusIconMarkup(statusId: string): string | null {
  if (statusId === 'recovery-deficit') return UI_ICONS.recovery;
  if (statusId === 'strength-protection') return UI_ICONS.shield;
  if (statusId === 'pace-zone2') return UI_ICONS.zone2;
  if (statusId === 'pace-lsd') return UI_ICONS.route;
  if (statusId === 'pace-interval') return UI_ICONS.interval;
  return null;
}

function getEducationIconMarkup(topic: EducationTopic): string {
  return UI_ICONS[topic];
}

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
            <div class="runner-mark" aria-hidden="true">
              <span class="ui-icon ui-icon--runner">${UI_ICONS.runner}</span>
            </div>
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
                <span class="ui-icon ui-icon--play" aria-hidden="true">${UI_ICONS.play}</span>
                開始備賽
              </button>
              <button
                class="button button--secondary button--large"
                data-leaderboard-open
                data-testid="leaderboard-home-button"
                type="button"
              >
                <span class="ui-icon ui-icon--leaderboard" aria-hidden="true">${UI_ICONS.leaderboard}</span>
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
              <span class="ui-icon ui-icon--pause" aria-hidden="true">${UI_ICONS.pause}</span>
              <span>暫停</span>
            </button>
            <button
              class="icon-button"
              data-testid="sound-toggle"
              type="button"
              aria-label="關閉聲音"
              aria-pressed="true"
            >
              <span class="ui-icon ui-icon--sound" data-sound-icon data-state="on" aria-hidden="true">${UI_ICONS.sound}</span>
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

          <div class="vitals-card">
            <div class="vital" data-energy-meter role="meter" aria-label="體力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
              <div class="vital-heading">
                <span><span class="ui-icon ui-icon--energy" aria-hidden="true">${UI_ICONS.energy}</span> 體力</span>
                <strong data-energy-value>100 / 100</strong>
              </div>
              <div class="bar-track" aria-hidden="true">
                <span class="bar-fill bar-fill--energy" data-energy-fill></span>
              </div>
            </div>

            <div class="vital" data-risk-meter role="meter" aria-label="受傷風險" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div class="vital-heading">
                <span><span class="ui-icon ui-icon--risk" aria-hidden="true">${UI_ICONS.risk}</span> 受傷風險</span>
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

          <div class="hud-summary" data-priority="secondary" aria-label="本局次要資訊">
            <div class="metric-card">
              <span class="metric-label">里程</span>
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
            <span class="jump-button__icon ui-icon ui-icon--jump" aria-hidden="true">${UI_ICONS.jump}</span>
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
            <span class="overlay-icon ui-icon ui-icon--pause" aria-hidden="true">${UI_ICONS.pause}</span>
            <h2 id="pause-title">已暫停</h2>
            <p>喘口氣，準備好再繼續。</p>
            <button class="button button--primary button--large" data-testid="resume-button" type="button">
              <span class="ui-icon ui-icon--play" aria-hidden="true">${UI_ICONS.play}</span>
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
          aria-describedby="game-over-reason game-over-education game-over-action game-over-disclaimer"
          tabindex="-1"
          hidden
        >
          <div class="overlay-card result-card">
            <p class="eyebrow" data-result-eyebrow>本次備賽紀錄</p>
            <h2 id="game-over-title" data-result-title>本次備賽中止</h2>
            <div class="outcome-banner" data-outcome-banner>
              <span class="outcome-banner__icon" data-outcome-icon data-icon="stopped" aria-hidden="true">
                <span class="ui-icon ui-icon--outcome-stopped">${UI_ICONS.pause}</span>
                <span class="ui-icon ui-icon--outcome-completed">
                  <svg class="ui-icon__svg" viewBox="0 0 24 24" focusable="false">
                    <path d="M6 21V3m0 2h11l-2.1 3L17 11H6" />
                  </svg>
                </span>
              </span>
              <span>
                <small data-outcome-label>本次抵達</small>
                <strong data-result-stage>第 1 關・基礎期</strong>
              </span>
            </div>
            <p class="new-record" data-new-record hidden>
              <span class="ui-icon ui-icon--leaderboard" aria-hidden="true">${UI_ICONS.leaderboard}</span>
              新紀錄！
            </p>

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

            <div class="failure-box" data-result-reason-box>
              <span data-reason-label>中途停止原因</span>
              <strong id="game-over-reason" data-failure-reason>體力耗盡</strong>
            </div>

            <p class="education-focus-label">
              <span class="ui-icon ui-icon--target" aria-hidden="true">${UI_ICONS.target}</span>
              本局重點提醒
            </p>
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

            <p id="game-over-disclaimer" class="game-over-disclaimer">
              一般衛教，不取代醫療診斷、個別訓練處方或營養評估。
            </p>

            <details
              class="education-hub"
              data-education-hub
              data-testid="education-hub"
              hidden
            >
              <summary>
                <span>
                  <strong>衛教補給站</strong>
                  <small data-education-hub-teaser>訓練・傷害・營養</small>
                </span>
                <span class="education-hub__toggle" aria-hidden="true"></span>
              </summary>
              <p class="education-hub__intro">每局輪替三個一般重點；切換分類，每次帶走一件事。</p>
              <section class="knowledge-review" data-knowledge-review hidden>
                <div class="knowledge-review__heading">
                  <strong>本局知識回顧</strong>
                  <small>依本局實際事件整理</small>
                </div>
                <ul data-knowledge-review-list></ul>
              </section>
              <div
                class="education-topic-switcher"
                data-education-topic-switcher
                role="group"
                aria-label="衛教主題"
              ></div>
              <article
                id="education-reminder-panel"
                class="education-reminder-card"
                data-education-reminder-card
                aria-labelledby="education-reminder-title"
                aria-live="polite"
                aria-atomic="true"
              >
                <div class="education-reminder-card__heading">
                  <span class="education-reminder-card__icon" data-reminder-icon aria-hidden="true"></span>
                  <span>
                    <small data-reminder-topic></small>
                    <strong id="education-reminder-title" data-reminder-title></strong>
                  </span>
                </div>
                <p data-reminder-message></p>
                <p class="education-reminder-card__action">
                  <strong>帶走一件事</strong>
                  <span data-reminder-action></span>
                </p>
                <a
                  class="education-reminder-card__source"
                  data-reminder-source
                  target="_blank"
                  rel="noopener noreferrer"
                ></a>
              </article>
              <aside class="education-safety-alert" data-education-safety-alert>
                <strong data-safety-alert-title></strong>
                <p data-safety-alert-message></p>
              </aside>
            </details>

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
                  送出並記錄
                </button>
              </div>
              <p id="score-save-status" class="score-save-status" data-score-save-status aria-live="polite">
                成績不會自動上傳；請輸入暱稱並按「送出並記錄」。
              </p>
            </form>

            <div class="result-actions">
              <button class="button button--primary" data-testid="restart-button" type="button">
                <span class="ui-icon ui-icon--restart" aria-hidden="true">${UI_ICONS.restart}</span>
                <span data-restart-label>調整策略再挑戰</span>
              </button>
              <button class="button button--secondary" data-share-button type="button">
                <span class="ui-icon ui-icon--share" aria-hidden="true">${UI_ICONS.share}</span>
                分享成績
              </button>
              <button
                class="button button--secondary"
                data-download-share-card
                data-testid="download-share-card-button"
                type="button"
              >
                <span class="ui-icon ui-icon--download" aria-hidden="true">${UI_ICONS.download}</span>
                儲存分享圖
              </button>
              <button
                class="button button--secondary"
                data-leaderboard-open
                data-testid="leaderboard-result-button"
                type="button"
              >
                <span class="ui-icon ui-icon--leaderboard" aria-hidden="true">${UI_ICONS.leaderboard}</span>
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
                <span class="ui-icon ui-icon--close" aria-hidden="true">${UI_ICONS.close}</span>
                <span>關閉</span>
              </button>
            </div>

            <p id="leaderboard-device-note" class="leaderboard-device-note">
              <span class="leaderboard-verification-mark" aria-hidden="true">✓</span>
              只顯示通過伺服器規則檢查的成績；暱稱請勿填入真實姓名或敏感資訊。
            </p>

            <div
              class="leaderboard-scroll"
              data-leaderboard-table
              tabindex="0"
              aria-label="排行榜表格，可左右滑動查看完整欄位"
              hidden
            >
              <p class="leaderboard-scroll-hint">
                <span aria-hidden="true">↔</span>
                左右滑動查看里程與結果
              </p>
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
              <span class="leaderboard-empty__icon ui-icon ui-icon--leaderboard" data-leaderboard-empty-icon aria-hidden="true">${UI_ICONS.leaderboard}</span>
              <strong data-leaderboard-empty-title>還沒有網路成績</strong>
              <p data-leaderboard-empty-message>完成一局並輸入暱稱，就能成為第一位上榜跑者。</p>
            </div>
          </div>
        </section>
      </div>
    </main>

    <footer class="medical-disclaimer">
      <span class="medical-disclaimer__notice">
        <span class="ui-icon ui-icon--info" aria-hidden="true">${UI_ICONS.info}</span>
        本遊戲僅供娛樂與衛教，不取代醫療診斷、個別評估或正式備賽計畫。
      </span>
      <span class="creator-credit">
        製作者
        <a
          data-testid="creator-link"
          href="https://sportsmedicine.tw/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="前往運動醫學科吳易澄醫師網站（另開新分頁）"
        >運動醫學科 吳易澄醫師</a>
      </span>
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
  private shareContentGeneration = 0;
  private scoreSubmissionPending = false;
  private shareAssetOperationPending = false;
  private renderedStatusSignature = '';
  private renderedStatusIds = new Set<string>();
  private feedbackTimerId: number | null = null;
  private educationReminders: readonly EducationReminderCard[] = [];
  private activeEducationTopic: EducationTopic | null = null;

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

  setStageTransitionActive(active: boolean): void {
    this.hudLayer.dataset.stageTransition = String(active);
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
    icon.dataset.state = enabled ? 'on' : 'off';
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
    this.shareContentGeneration += 1;
    this.gameOverScreen.dataset.outcome = outcome;
    this.element<HTMLElement>('[data-outcome-banner]').dataset.outcome = outcome;
    this.element<HTMLElement>('[data-result-reason-box]').dataset.outcome = outcome;
    this.text('[data-result-eyebrow]', outcome === 'completed' ? '三階段挑戰完成' : '本次備賽紀錄');
    this.text('[data-result-title]', outcome === 'completed' ? '恭喜順利完賽！' : '本次備賽中止');
    this.element<HTMLElement>('[data-outcome-icon]').dataset.icon = outcome;
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
    this.renderEducationReminders(
      summary.educationReminders ?? [],
      summary.educationFocusTopic,
      summary.educationSafetyAlert,
      summary.knowledgeReview ?? [],
    );
    this.text('[data-share-status]', '');
    this.element('[data-new-record]').hidden = !summary.isNewHighScore;
    this.setView('game-over');
  }

  setSharePlayerName(name: string): void {
    if (this.shareCardInput === null) return;

    this.shareCardInput = { ...this.shareCardInput, nickname: name };
    this.refreshShareContent();
  }

  /**
   * 顯示伺服器已排序資料的前 10 筆；相同結果、分數與距離使用競賽名次。
   * 所有動態文字均以 textContent 寫入。
   */
  showLeaderboard(rows: readonly LeaderboardRow[], currentId?: string): void {
    const body = this.element<HTMLTableSectionElement>('[data-leaderboard-body]');
    const table = this.element<HTMLElement>('[data-leaderboard-table]');
    const empty = this.element<HTMLElement>('[data-leaderboard-empty]');
    const visibleRows = rows.slice(0, 10);
    body.replaceChildren();
    let displayedRank = 0;
    let previousEntry: LeaderboardRow | undefined;

    visibleRows.forEach((entry, index) => {
      const row = document.createElement('tr');
      const isCurrent = currentId !== undefined && entry.id === currentId;
      row.dataset.current = String(isCurrent);
      if (isCurrent) row.setAttribute('aria-current', 'true');

      const isTiedWithPrevious =
        previousEntry !== undefined &&
        entry.outcome === previousEntry.outcome &&
        entry.score === previousEntry.score &&
        entry.distanceMeters === previousEntry.distanceMeters;
      if (!isTiedWithPrevious) displayedRank = index + 1;
      row.dataset.rank = String(displayedRank);
      row.style.setProperty('--leaderboard-row-index', String(index));
      const rankCell = document.createElement('td');
      rankCell.className = 'leaderboard-rank';
      if (displayedRank <= 3) {
        const medal = document.createElement('span');
        medal.className = 'leaderboard-rank__medal';
        medal.setAttribute('aria-hidden', 'true');
        rankCell.append(medal);
      }
      rankCell.append(document.createTextNode(`#${displayedRank}`));
      row.append(rankCell);
      previousEntry = entry;

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

    if (this.shareCardInput !== null) {
      this.shareCardInput = {
        ...this.shareCardInput,
        nickname: safeName,
        leaderboardRank: safeRank > 0 ? safeRank : null,
      };
      this.refreshShareContent();
    }
    this.setScoreSubmissionPending(false);
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
    this.setScoreSubmissionPending(false);
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
    button.textContent = '送出並記錄';
    status.removeAttribute('data-state');
    status.textContent = '成績不會自動上傳；請輸入暱稱並按「送出並記錄」。';
    this.setScoreSubmissionPending(false);
  }

  destroy(): void {
    this.eventController.abort();
    this.clearFeedback();
    delete this.root.dataset.gameView;
    this.root.replaceChildren();
  }

  private bindControls(): void {
    const signal = this.eventController.signal;

    this.element<HTMLElement>('[data-education-topic-switcher]').addEventListener(
      'click',
      (event) => {
        const button =
          event.target instanceof Element
            ? event.target.closest<HTMLButtonElement>('[data-education-topic]')
            : null;
        const topic = button?.dataset.educationTopic;
        if (!this.isEducationTopic(topic)) return;
        this.setActiveEducationTopic(topic);
      },
      { signal },
    );

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

    this.element<HTMLButtonElement>('[data-download-share-card]').addEventListener(
      'click',
      () => void this.downloadShareCard(),
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

        if (this.shareAssetOperationPending) {
          status.dataset.state = 'pending';
          status.textContent = '分享處理完成後即可送出排行榜驗證。';
          return;
        }

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
        this.setScoreSubmissionPending(true);
        status.dataset.state = 'pending';
        status.textContent = '正在驗證並記錄成績；完成前請留在此頁…';
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
    this.root.dataset.gameView = view;
    this.homeScreen.hidden = view !== 'home';
    this.hudLayer.hidden = view === 'home';
    this.pauseOverlay.hidden = view !== 'paused';
    this.gameOverScreen.hidden = view !== 'game-over';
    this.medicalDisclaimer.hidden = view === 'playing' || view === 'paused';

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
    const statusIds = new Set(statuses.length === 0 ? ['healthy'] : statuses.map(({ id }) => id));
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
    const previousStatusIds = this.renderedStatusIds;
    this.renderedStatusIds = statusIds;

    const list = this.element<HTMLUListElement>('[data-status-list]');
    list.replaceChildren();

    if (statuses.length === 0) {
      const item = document.createElement('li');
      item.className = 'status-chip status-chip--neutral';
      if (!previousStatusIds.has('healthy')) item.classList.add('status-chip--entering');
      item.textContent = '狀態良好';
      list.append(item);
      return;
    }

    statuses.forEach((status) => {
      const item = document.createElement('li');
      item.className = `status-chip status-chip--${status.tone ?? 'neutral'}`;
      if (!previousStatusIds.has(status.id)) item.classList.add('status-chip--entering');
      item.dataset.statusId = status.id;

      const iconMarkup = getStatusIconMarkup(status.id);
      if (iconMarkup) {
        const icon = document.createElement('span');
        icon.className = 'ui-icon status-chip__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = iconMarkup;
        item.append(icon);
      }

      const label = iconMarkup
        ? status.label
        : [status.icon, status.label].filter(Boolean).join(' ');
      const visibleText =
        typeof status.remainingSeconds === 'number'
          ? `${label} ${Math.max(0, Math.ceil(status.remainingSeconds))} 秒`
          : label;
      item.append(document.createTextNode(visibleText));
      list.append(item);
    });
  }

  private renderEducationReminders(
    reminders: readonly EducationReminderCard[],
    preferredTopic: EducationTopic | undefined,
    safetyAlert: EducationSafetyAlert | undefined,
    knowledgeReview: readonly RunKnowledgeItem[],
  ): void {
    const hub = this.element<HTMLDetailsElement>('[data-education-hub]');
    const switcher = this.element<HTMLElement>('[data-education-topic-switcher]');
    const review = this.element<HTMLElement>('[data-knowledge-review]');
    const reviewList = this.element<HTMLUListElement>('[data-knowledge-review-list]');
    const uniqueReminders: EducationReminderCard[] = [];

    reminders.forEach((reminder) => {
      if (
        uniqueReminders.length < 3 &&
        this.isEducationTopic(reminder.topic) &&
        !uniqueReminders.some((current) => current.topic === reminder.topic)
      ) {
        uniqueReminders.push(reminder);
      }
    });

    this.educationReminders = uniqueReminders;
    this.renderKnowledgeReview(review, reviewList, knowledgeReview);
    switcher.replaceChildren();
    if (uniqueReminders.length === 0 && review.hidden) {
      this.activeEducationTopic = null;
      hub.hidden = true;
      return;
    }

    if (uniqueReminders.length === 0) {
      this.activeEducationTopic = null;
      switcher.hidden = true;
      this.element<HTMLElement>('[data-education-reminder-card]').hidden = true;
      const alert = this.element<HTMLElement>('[data-education-safety-alert]');
      alert.hidden = safetyAlert === undefined;
      this.text('[data-safety-alert-title]', safetyAlert?.title ?? '');
      this.text('[data-safety-alert-message]', safetyAlert?.message ?? '');
      hub.hidden = false;
      hub.open = false;
      this.text('[data-education-hub-teaser]', `${knowledgeReview.length} 個本局知識點`);
      return;
    }

    switcher.hidden = false;
    this.element<HTMLElement>('[data-education-reminder-card]').hidden = false;

    const initialTopic =
      preferredTopic && uniqueReminders.some((reminder) => reminder.topic === preferredTopic)
        ? preferredTopic
        : uniqueReminders[0]?.topic;
    this.activeEducationTopic = initialTopic ?? null;

    uniqueReminders.forEach((reminder) => {
      const button = document.createElement('button');
      const isPreferred = reminder.topic === preferredTopic;
      button.type = 'button';
      button.className = 'education-topic-button';
      button.dataset.educationTopic = reminder.topic;
      button.dataset.recommended = String(isPreferred);
      button.setAttribute('aria-controls', 'education-reminder-panel');
      button.setAttribute('aria-pressed', String(reminder.topic === this.activeEducationTopic));
      button.setAttribute(
        'aria-label',
        `${reminder.topicLabel}${isPreferred ? '，本局建議先看' : ''}`,
      );
      const icon = document.createElement('span');
      icon.className = 'ui-icon education-topic-button__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = getEducationIconMarkup(reminder.topic);
      button.append(icon, document.createTextNode(reminder.topicLabel));
      switcher.append(button);
    });

    const alert = this.element<HTMLElement>('[data-education-safety-alert]');
    alert.hidden = safetyAlert === undefined;
    this.text('[data-safety-alert-title]', safetyAlert?.title ?? '');
    this.text('[data-safety-alert-message]', safetyAlert?.message ?? '');

    hub.hidden = false;
    hub.open = false;
    this.renderActiveEducationReminder();
    const teaserReminder =
      uniqueReminders.find((reminder) => reminder.topic === initialTopic) ?? uniqueReminders[0];
    if (teaserReminder) {
      this.text(
        '[data-education-hub-teaser]',
        `本局先看：${teaserReminder.topicLabel}・${teaserReminder.title}`,
      );
    }
  }

  private renderKnowledgeReview(
    region: HTMLElement,
    list: HTMLUListElement,
    items: readonly RunKnowledgeItem[],
  ): void {
    list.replaceChildren();
    const seenIds = new Set<string>();

    items.forEach((item) => {
      if (seenIds.size >= 5 || seenIds.has(item.id)) return;
      seenIds.add(item.id);

      const row = document.createElement('li');
      row.dataset.knowledgeKind = item.kind;

      const heading = document.createElement('strong');
      heading.textContent = `${item.kind === 'obstacle' ? '注意' : '收集'}・${item.label}`;
      const message = document.createElement('span');
      message.textContent = item.message;
      const action = document.createElement('small');
      action.textContent = `可以這樣做：${item.action}`;
      row.append(heading, message, action);
      list.append(row);
    });

    region.hidden = seenIds.size === 0;
  }

  private setActiveEducationTopic(topic: EducationTopic): void {
    if (!this.educationReminders.some((reminder) => reminder.topic === topic)) return;
    this.activeEducationTopic = topic;
    this.renderActiveEducationReminder();
  }

  private renderActiveEducationReminder(): void {
    const reminder =
      this.educationReminders.find((current) => current.topic === this.activeEducationTopic) ??
      this.educationReminders[0];
    if (!reminder) return;

    this.activeEducationTopic = reminder.topic;
    const card = this.element<HTMLElement>('[data-education-reminder-card]');
    card.dataset.topic = reminder.topic;
    this.element<HTMLElement>('[data-reminder-icon]').innerHTML = getEducationIconMarkup(
      reminder.topic,
    );
    this.text('[data-reminder-topic]', reminder.topicLabel);
    this.text('[data-reminder-title]', reminder.title);
    this.text('[data-reminder-message]', reminder.message);
    this.text('[data-reminder-action]', reminder.action);

    const source = this.element<HTMLAnchorElement>('[data-reminder-source]');
    const sourceUrl = this.safeExternalUrl(reminder.source.url);
    source.hidden = sourceUrl === null;
    source.href = sourceUrl ?? '#';
    source.textContent = sourceUrl ? `資料參考：${reminder.source.label} ↗` : '';

    this.root.querySelectorAll<HTMLButtonElement>('[data-education-topic]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.educationTopic === reminder.topic));
    });
  }

  private isEducationTopic(value: string | undefined): value is EducationTopic {
    return value === 'training' || value === 'injury' || value === 'nutrition';
  }

  private safeExternalUrl(value: string): string | null {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
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
    const status = this.element<HTMLElement>('[data-share-status]');
    let text = '';
    let method: ShareMethod = 'unavailable';
    this.setShareAssetOperationPending(true);

    try {
      const payload = await this.getLatestShareContent();
      text = payload.text;
      if (!text) {
        status.textContent = '目前沒有可分享的成績。';
        return;
      }

      if (typeof navigator.share === 'function') {
        const textPayload: ShareData = { title: '馬拉松完賽訓練', text };
        const imagePayload: ShareData | null = payload.file
          ? { ...textPayload, files: [payload.file] }
          : null;
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
        status.textContent = canShareImage
          ? '成績卡已分享！'
          : '成績文字已分享；可另按「儲存分享圖」。';
      } else if (await this.copyToClipboard(text)) {
        method = 'clipboard';
        status.textContent = '成績文字已複製；可另按「儲存分享圖」。';
      } else {
        status.textContent = '無法自動複製；仍可按「儲存分享圖」。';
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        method = 'cancelled';
        status.textContent = '已取消分享。';
      } else if (await this.copyToClipboard(text)) {
        method = 'clipboard';
        status.textContent = '成績文字已複製；可另按「儲存分享圖」。';
      } else {
        status.textContent = '分享失敗，請稍後再試。';
      }
    } finally {
      this.setShareAssetOperationPending(false);
      this.callbacks.onShare(text, method);
    }
  }

  private async downloadShareCard(): Promise<void> {
    const status = this.element<HTMLElement>('[data-share-status]');
    let text = '';
    let method: ShareMethod = 'unavailable';
    this.setShareAssetOperationPending(true);

    try {
      const payload = await this.getLatestShareContent();
      text = payload.text;
      if (!payload.file || typeof URL.createObjectURL !== 'function') {
        status.textContent = '這個瀏覽器無法產生成績圖，仍可分享成績文字。';
        return;
      }

      const objectUrl = URL.createObjectURL(payload.file);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = payload.file.name;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      method = 'download';
      status.textContent = '1080×1080 成績分享圖已儲存！';
    } catch {
      status.textContent = '成績圖儲存失敗，請稍後再試。';
    } finally {
      this.setShareAssetOperationPending(false);
      this.callbacks.onShare(text, method);
    }
  }

  private async getLatestShareContent(): Promise<{ text: string; file: File | null }> {
    while (true) {
      const generation = this.shareContentGeneration;
      const text = this.shareText.trim();
      const file = await (this.shareCardFilePromise ?? Promise.resolve(null));
      if (generation === this.shareContentGeneration) return { text, file };
    }
  }

  private setScoreSubmissionPending(pending: boolean): void {
    this.scoreSubmissionPending = pending;
    this.syncShareActionState();
  }

  private setShareAssetOperationPending(pending: boolean): void {
    this.shareAssetOperationPending = pending;
    this.syncShareActionState();

    const input = this.element<HTMLInputElement>('[data-score-name]');
    const submit = this.element<HTMLButtonElement>('[data-score-submit]');
    if (pending) {
      submit.disabled = true;
    } else if (!this.scoreSubmissionPending && !input.disabled) {
      submit.disabled = false;
    }
  }

  private syncShareActionState(): void {
    const disabled = this.scoreSubmissionPending || this.shareAssetOperationPending;
    this.element<HTMLButtonElement>('[data-share-button]').disabled = disabled;
    this.element<HTMLButtonElement>('[data-download-share-card]').disabled = disabled;

    // Leaving the result screen while the finish request is in flight would
    // abandon its response and make a successful server write look like a
    // failed submission. Keep both navigation exits locked until it settles.
    this.element<HTMLButtonElement>('[data-testid="restart-button"]').disabled =
      this.scoreSubmissionPending;
    this.element<HTMLButtonElement>('[data-home-button]').disabled = this.scoreSubmissionPending;
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

  private refreshShareContent(): void {
    if (this.shareCardInput === null) return;
    this.shareText = buildShareText(this.shareCardInput);
    this.shareCardFilePromise = this.prepareShareCardFile(this.shareCardInput);
    this.shareContentGeneration += 1;
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
