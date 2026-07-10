import type {
  EducationReminderCard,
  EducationSafetyAlert,
  EducationTopic,
  RunKnowledgeItem,
} from '../shared/education';

export const OBSTACLE_TYPES = ['illness', 'sportsInjury', 'overtraining'] as const;

export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

export const RECOVERY_ITEM_TYPES = [
  'sleep',
  'strength',
  'nutrition',
  'zone2',
  'lsd',
  'interval',
] as const;

export type RecoveryItemType = (typeof RECOVERY_ITEM_TYPES)[number];

export const MARATHON_STAGE_IDS = ['base', 'build', 'race'] as const;

export type MarathonStageId = (typeof MARATHON_STAGE_IDS)[number];

export const PACE_MODES = ['zone2', 'lsd', 'interval'] as const;

export type PaceMode = (typeof PACE_MODES)[number];

export type PlayerAnimationState =
  'idle' | 'running' | 'jumping' | 'hurt' | 'finished' | 'gameOver';

export type GameOverReason = 'energyDepleted' | 'injuryRiskMaxed';

export interface Vitals {
  energy: number;
  injuryRisk: number;
}

/**
 * 狀態剩餘秒數。0 表示狀態未啟用。
 */
export interface GameStatusEffects {
  recoveryDeficitRemainingSeconds: number;
  strengthProtectionRemainingSeconds: number;
  paceMode: PaceMode | null;
  paceRemainingSeconds: number;
}

/**
 * 每種障礙對玩家造成影響的累計次數。
 */
export type ObstacleImpactCounts = Record<ObstacleType, number>;

export interface ObstacleImpactResult {
  vitals: Vitals;
  statusEffects: GameStatusEffects;
  energyDamage: number;
  injuryRiskDamage: number;
}

export interface RecoveryItemResult {
  vitals: Vitals;
  statusEffects: GameStatusEffects;
  energyRecovered: number;
  injuryRiskReduced: number;
  paceModeActivated: PaceMode | null;
}

export interface StatusAdvanceResult {
  vitals: Vitals;
  statusEffects: GameStatusEffects;
  paceModeExpired: boolean;
  recoveryDeficitExpired: boolean;
}

export type MarathonOutcomeStatus = 'inProgress' | 'finished' | 'didNotFinish';

export type MarathonOutcomeReason =
  'completedAllStages' | 'energyDepleted' | 'injuryRiskMaxed' | null;

export interface MarathonOutcome {
  status: MarathonOutcomeStatus;
  reason: MarathonOutcomeReason;
}

export interface MarathonStageSnapshot {
  stageId: MarathonStageId;
  stageIndex: number;
  stageElapsedSeconds: number;
  stageRemainingSeconds: number;
  totalElapsedSeconds: number;
  totalRemainingSeconds: number;
  overallProgress: number;
  nextStageId: MarathonStageId | null;
  isComplete: boolean;
}

export interface MarathonRunState {
  elapsedSeconds: number;
  vitals: Vitals;
  statusEffects: GameStatusEffects;
  stage: MarathonStageSnapshot;
  outcome: MarathonOutcome;
}

export interface GameProgress {
  elapsedSeconds: number;
  distanceMeters: number;
  score: number;
  speed: number;
  difficultyLevel: number;
  collectedRecoveryItems: number;
}

export interface HudSnapshot {
  elapsedSeconds: number;
  distanceMeters: number;
  score: number;
  energy: number;
  injuryRisk: number;
  speed: number;
  difficultyLevel: number;
  stageId: MarathonStageId;
  stageIndex: number;
  overallProgress: number;
  paceMode: PaceMode | null;
  statusEffects: GameStatusEffects;
  isPaused: boolean;
  isSoundEnabled: boolean;
  collectedRecoveryItems: number;
}

export interface GameOverResult {
  outcome: 'completed' | 'stopped';
  reason: GameOverReason | null;
  stageId: MarathonStageId;
  stageIndex: number;
  overallProgress: number;
  dominantObstacle: ObstacleType | null;
  distanceMeters: number;
  score: number;
  elapsedSeconds: number;
  collectedRecoveryItems: number;
  highScore: number;
  isNewHighScore: boolean;
  educationMessage: string;
  educationAction: string;
  educationReminders: readonly EducationReminderCard[];
  educationFocusTopic: EducationTopic;
  educationSafetyAlert: EducationSafetyAlert;
  knowledgeReview: readonly RunKnowledgeItem[];
}

/**
 * 僅供目前瀏覽器顯示的本機排行榜紀錄；資料未經伺服器驗證，並非權威成績。
 * createdAt 使用 Unix epoch 毫秒，讓同分紀錄能以較早建立者優先。
 */
export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  distanceMeters: number;
  outcome: GameOverResult['outcome'];
  stageId: MarathonStageId;
  createdAt: number;
}

export interface LeaderboardEntryInput {
  name?: string;
  score: number;
  distanceMeters: number;
  outcome: GameOverResult['outcome'];
  stageId: MarathonStageId;
}

export interface LeaderboardAddResult {
  entry: LeaderboardEntry;
  leaderboard: LeaderboardEntry[];
  /** 1 起算；若成績未進入保留的前十名則為 null。 */
  rank: number | null;
  /** 只有 localStorage 寫入成功才為 true。 */
  persisted: boolean;
}

export interface EducationMessage {
  id: number;
  text: string;
  action: string;
}

/** localStorage 與測試用記憶體 storage 共用的最小介面。 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
