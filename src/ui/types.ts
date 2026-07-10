/**
 * DOM UI contracts. These types deliberately avoid importing Phaser so the
 * presentation layer can be tested or replaced independently of the game.
 */

export type GameUIView = 'home' | 'playing' | 'paused' | 'game-over';

export type StatusTone = 'neutral' | 'positive' | 'warning' | 'danger';

export type MarathonStageNumber = 1 | 2 | 3;

export type PaceTone = 'comfortable' | 'steady' | 'challenging' | 'warning';

export type RunOutcome = 'completed' | 'stopped';

export interface HUDStatus {
  /** Stable key used when a status is updated or removed. */
  id: string;
  label: string;
  icon?: string;
  remainingSeconds?: number;
  tone?: StatusTone;
}

export interface HUDState {
  distanceMeters: number;
  score: number;
  energy: number;
  maxEnergy: number;
  injuryRisk: number;
  maxInjuryRisk: number;
  speed: number;
  difficultyLevel: number;
  difficultyLabel?: string;
  statuses: HUDStatus[];
  /** 目前所在的馬拉松備賽關卡；舊版呼叫未提供時顯示第 1 關。 */
  stageNumber?: MarathonStageNumber;
  /** 第一版固定為三關，保留欄位方便 UI 顯示完整分母。 */
  totalStages?: number;
  stageName?: string;
  /** 0～100 的全程進度百分比。 */
  overallProgressPercent?: number;
  /** 同時提供文字與 tone，配速資訊不會只靠顏色傳達。 */
  paceLabel?: string;
  paceTone?: PaceTone;
}

export interface GameOverSummary {
  distanceMeters: number;
  score: number;
  highScore: number;
  failureReason: string;
  educationMessage: string;
  educationAction: string;
  /** 未提供時，UI 會依 completed／stopped 自動建立繁中分享文案。 */
  shareText?: string;
  isNewHighScore?: boolean;
  /** 舊版遊戲結束事件未提供時，維持「中途停止」行為。 */
  outcome?: RunOutcome;
  stageNumber?: MarathonStageNumber;
  totalStages?: number;
  stageName?: string;
}

/**
 * 已由伺服器排序的單筆排行榜資料。UI 只顯示傳入順序的前 10 筆，
 * 不負責網路請求或資料驗證。
 */
export interface LeaderboardRow {
  id: string;
  name: string;
  score: number;
  distanceMeters: number;
  outcome: RunOutcome;
}

/** 新三關流程可使用的語意名稱；保留原型別避免既有整合中斷。 */
export type UiSnapshot = HUDState;
export type UiResult = GameOverSummary;

export type ShareMethod = 'web-share' | 'clipboard' | 'cancelled' | 'unavailable';

export interface GameUICallbacks {
  onStart: () => void;
  onJump: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  onSoundChange: (enabled: boolean) => void;
  /** 請控制層讀取網路排行榜後呼叫 showLeaderboard。 */
  onLeaderboardOpen: () => void;
  /** 暱稱已去除前後空白，且最多 12 個 UTF-16 code units。 */
  onScoreSubmit: (name: string) => void;
  /** Called after the built-in Web Share / clipboard flow finishes. */
  onShare: (text: string, method: ShareMethod) => void;
}

export interface GameUIOptions {
  root: HTMLElement | string;
  callbacks?: Partial<GameUICallbacks>;
  initialSoundEnabled?: boolean;
}

export const DEFAULT_HUD_STATE: HUDState = {
  distanceMeters: 0,
  score: 0,
  energy: 100,
  maxEnergy: 100,
  injuryRisk: 0,
  maxInjuryRisk: 100,
  speed: 300,
  difficultyLevel: 1,
  difficultyLabel: '起步',
  statuses: [],
  stageNumber: 1,
  totalStages: 3,
  stageName: '基礎期',
  overallProgressPercent: 0,
  paceLabel: '舒適起跑',
  paceTone: 'comfortable',
};
