import type { PaceMode, RecoveryItemType } from '../types';

export interface PaceModeConfig {
  readonly durationSeconds: number;
  readonly speedMultiplier: number;
  readonly energyDrainMultiplier: number;
  readonly immediateEnergyRecovery: number;
  /** 1 不改變；低於 1 會安全縮短下一個道具機會。 */
  readonly nextItemSpawnDelayMultiplier: number;
}

export type RenderQualityId = 'economy' | 'balanced' | 'high';
export type RenderScale = 1 | 1.5 | 2;

/**
 * 僅包含穩定、與裝置型號無關的能力訊號，方便測試且不依賴 UA 猜測。
 * 缺少的瀏覽器欄位維持 undefined，不會被誤判為低階裝置。
 */
export interface RenderCapabilitySnapshot {
  readonly devicePixelRatio?: number;
  readonly hardwareConcurrency?: number;
  readonly deviceMemoryGb?: number;
  readonly saveData?: boolean;
  readonly prefersReducedData?: boolean;
}

export interface RenderQualityProfile {
  readonly id: RenderQualityId;
  readonly renderScale: RenderScale;
}

export interface RenderQualityConfig {
  readonly economyScale: RenderScale;
  readonly balancedScale: RenderScale;
  readonly highScale: RenderScale;
  readonly economyDpiThreshold: number;
  readonly balancedDpiThreshold: number;
  readonly lowCoreThreshold: number;
  readonly balancedCoreThreshold: number;
  readonly lowMemoryGbThreshold: number;
  readonly balancedMemoryGbThreshold: number;
}

export interface GameConfig {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  /** Canvas backing-buffer multiplier ceiling; runtime selection may use a lower scale. */
  readonly renderScale: RenderScale;
  readonly groundY: number;
  readonly playerStartX: number;
  readonly playerWidth: number;
  readonly playerHeight: number;
  readonly gravityY: number;
  readonly jumpVelocity: number;
  readonly jumpBufferSeconds: number;
  readonly roadSignWidth: number;
  readonly roadSignHeight: number;
  readonly initialSpeed: number;
  readonly maximumSpeed: number;
  readonly maximumDifficultyLevel: number;
  readonly speedIncreaseEverySeconds: number;
  readonly speedIncreaseRate: number;
  readonly initialEnergy: number;
  readonly initialInjuryRisk: number;
  readonly minEnergy: number;
  readonly maxEnergy: number;
  readonly minInjuryRisk: number;
  readonly maxInjuryRisk: number;
  readonly passiveEnergyDrainPerSecond: number;
  readonly illnessEnergyDamage: number;
  readonly illnessRiskDamage: number;
  readonly illnessRecoveryDeficitSeconds: number;
  readonly sportsInjuryEnergyDamage: number;
  readonly sportsInjuryRiskDamage: number;
  readonly overtrainingEnergyDamage: number;
  readonly overtrainingRiskDamage: number;
  readonly overtrainingRecoveryDeficitSeconds: number;
  readonly sleepEnergyRecovery: number;
  readonly sleepRiskReduction: number;
  readonly strengthProtectionSeconds: number;
  readonly nutritionEnergyRecovery: number;
  readonly paceModes: Readonly<Record<PaceMode, PaceModeConfig>>;
  readonly strengthProtectionDamageMultiplier: number;
  readonly recoveryDeficitRecoveryMultiplier: number;
  readonly recoveryDeficitEnergyDrainMultiplier: number;
  readonly hurtInvulnerabilitySeconds: number;
  readonly hurtAnimationSeconds: number;
  readonly metersPerPixel: number;
  readonly scorePerMeter: number;
  readonly recoveryItemScoreBonus: number;
  readonly obstacleSpawnMinSeconds: number;
  readonly obstacleSpawnMaxSeconds: number;
  readonly firstObstacleSpawnDelaySeconds: number;
  readonly recoverySpawnMinSeconds: number;
  readonly recoverySpawnMaxSeconds: number;
  readonly firstRecoverySpawnDelaySeconds: number;
  readonly firstRecoveryItemType: RecoveryItemType;
  readonly firstRunTutorialAutoStartSeconds: number;
  readonly spawnAheadPixels: number;
  readonly minimumObstacleGapPixels: number;
  readonly minimumObstacleRecoveryGapPixels: number;
  readonly spawnTransitionSafetyMs: number;
  readonly maximumConcurrentObstacles: number;
  readonly obstacleDespawnX: number;
  readonly recoveryItemDespawnX: number;
  readonly recoveryItemLowHeightAboveGround: number;
  readonly recoveryItemHighHeightAboveGround: number;
  readonly idleBackdropSpeed: number;
  readonly tutorialBackdropSpeed: number;
  readonly hudUpdateIntervalMs: number;
  readonly tutorialHeightAboveGround: number;
  /** First-jump confirmation sits right of the runner's airborne silhouette. */
  readonly tutorialSuccessMessageX: number;
  readonly tutorialRisePixels: number;
  readonly tutorialDelayMs: number;
  readonly tutorialFadeDurationMs: number;
  readonly hitFeedbackDestroyDelayMs: number;
  readonly cameraShakeDurationMs: number;
  readonly cameraShakeIntensity: number;
  readonly feedbackDurationMs: number;
  readonly educationFeedbackDurationMs: number;
  readonly difficultyFeedbackDurationMs: number;
  readonly stageTransitionDurationMs: number;
  readonly finishGateSpawnOffsetPixels: number;
  readonly highScoreStorageKey: string;
  readonly leaderboardStorageKey: string;
  readonly leaderboardMaxEntries: number;
  readonly leaderboardNameMaxLength: number;
  readonly leaderboardDefaultName: string;
  readonly leaderboardIdMaxLength: number;
}

export const RENDER_QUALITY_CONFIG = {
  economyScale: 1,
  balancedScale: 1.5,
  highScale: 2,
  economyDpiThreshold: 1,
  balancedDpiThreshold: 1.5,
  lowCoreThreshold: 2,
  balancedCoreThreshold: 4,
  lowMemoryGbThreshold: 2,
  balancedMemoryGbThreshold: 4,
} as const satisfies RenderQualityConfig;

const RENDER_QUALITY_PROFILES: Readonly<Record<RenderQualityId, RenderQualityProfile>> = {
  economy: { id: 'economy', renderScale: RENDER_QUALITY_CONFIG.economyScale },
  balanced: { id: 'balanced', renderScale: RENDER_QUALITY_CONFIG.balancedScale },
  high: { id: 'high', renderScale: RENDER_QUALITY_CONFIG.highScale },
};

function isAtMost(value: number | undefined, threshold: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= threshold;
}

function safeDevicePixelRatio(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * 選擇 backing buffer 品質，不改變 540 × 960 邏輯世界、物理或遊戲速度。
 */
export function selectRenderQualityProfile(
  capabilities: RenderCapabilitySnapshot,
  config: RenderQualityConfig = RENDER_QUALITY_CONFIG,
): RenderQualityProfile {
  const dpr = safeDevicePixelRatio(capabilities.devicePixelRatio);
  const shouldSaveResources = capabilities.saveData || capabilities.prefersReducedData;
  const isSeverelyConstrained =
    isAtMost(capabilities.hardwareConcurrency, config.lowCoreThreshold) ||
    isAtMost(capabilities.deviceMemoryGb, config.lowMemoryGbThreshold);

  if (shouldSaveResources || isSeverelyConstrained) {
    return { id: 'economy', renderScale: config.economyScale };
  }

  const nativeProfile: RenderQualityProfile =
    dpr <= config.economyDpiThreshold
      ? { id: 'economy', renderScale: config.economyScale }
      : dpr <= config.balancedDpiThreshold
        ? { id: 'balanced', renderScale: config.balancedScale }
        : { id: 'high', renderScale: config.highScale };

  const isModeratelyConstrained =
    isAtMost(capabilities.hardwareConcurrency, config.balancedCoreThreshold) ||
    isAtMost(capabilities.deviceMemoryGb, config.balancedMemoryGbThreshold);

  if (isModeratelyConstrained && nativeProfile.id === 'high') {
    return { id: 'balanced', renderScale: config.balancedScale };
  }

  return nativeProfile;
}

export function normalizeRenderScale(value: number): RenderScale {
  if (!Number.isFinite(value) || value <= 1) return RENDER_QUALITY_PROFILES.economy.renderScale;
  if (value < 2) return RENDER_QUALITY_PROFILES.balanced.renderScale;
  return RENDER_QUALITY_PROFILES.high.renderScale;
}

/**
 * 所有可調整的遊戲數值都集中在此，場景與系統不應重複寫死數值。
 */
export const GAME_CONFIG = {
  canvasWidth: 540,
  canvasHeight: 960,
  renderScale: RENDER_QUALITY_CONFIG.highScale,
  groundY: 800,
  playerStartX: 108,
  playerWidth: 58,
  playerHeight: 86,
  gravityY: 1_800,
  jumpVelocity: -720,
  jumpBufferSeconds: 0.12,
  roadSignWidth: 68,
  roadSignHeight: 88,

  initialSpeed: 300,
  // 兼顧低更新率手機的 Arcade overlap，避免高速物件跨越玩家而漏判碰撞。
  maximumSpeed: 1_200,
  maximumDifficultyLevel: 30,
  speedIncreaseEverySeconds: 10,
  speedIncreaseRate: 0.05,

  initialEnergy: 100,
  initialInjuryRisk: 0,
  minEnergy: 0,
  maxEnergy: 100,
  minInjuryRisk: 0,
  maxInjuryRisk: 100,
  passiveEnergyDrainPerSecond: 0.5,

  illnessEnergyDamage: 18,
  illnessRiskDamage: 10,
  illnessRecoveryDeficitSeconds: 6,
  sportsInjuryEnergyDamage: 12,
  sportsInjuryRiskDamage: 35,
  overtrainingEnergyDamage: 15,
  overtrainingRiskDamage: 22,
  overtrainingRecoveryDeficitSeconds: 8,

  sleepEnergyRecovery: 12,
  sleepRiskReduction: 12,
  strengthProtectionSeconds: 5,
  nutritionEnergyRecovery: 20,

  // 配速模式是遊戲化效果，不代表真實生理反應或個人化訓練處方。
  paceModes: {
    zone2: {
      durationSeconds: 7,
      speedMultiplier: 0.94,
      energyDrainMultiplier: 0.72,
      immediateEnergyRecovery: 0,
      nextItemSpawnDelayMultiplier: 1,
    },
    lsd: {
      durationSeconds: 9,
      speedMultiplier: 0.98,
      energyDrainMultiplier: 0.58,
      immediateEnergyRecovery: 8,
      nextItemSpawnDelayMultiplier: 1,
    },
    interval: {
      durationSeconds: 5,
      speedMultiplier: 1.18,
      energyDrainMultiplier: 1.3,
      immediateEnergyRecovery: 0,
      nextItemSpawnDelayMultiplier: 0.6,
    },
  },

  strengthProtectionDamageMultiplier: 0.5,
  recoveryDeficitRecoveryMultiplier: 0.5,
  recoveryDeficitEnergyDrainMultiplier: 1.25,
  hurtInvulnerabilitySeconds: 0.8,
  hurtAnimationSeconds: 0.35,

  // 300 px/s 約為 18 m/s，一局 60–90 秒會落在約 1,100–1,800 公尺。
  metersPerPixel: 0.06,
  scorePerMeter: 1,
  recoveryItemScoreBonus: 50,

  obstacleSpawnMinSeconds: 1.7,
  obstacleSpawnMaxSeconds: 3,
  firstObstacleSpawnDelaySeconds: 3.5,
  recoverySpawnMinSeconds: 3.8,
  recoverySpawnMaxSeconds: 6.5,
  firstRecoverySpawnDelaySeconds: 2.2,
  firstRecoveryItemType: 'nutrition',
  firstRunTutorialAutoStartSeconds: 4,
  spawnAheadPixels: 90,
  minimumObstacleGapPixels: 290,
  minimumObstacleRecoveryGapPixels: 150,
  spawnTransitionSafetyMs: 100,
  maximumConcurrentObstacles: 2,
  obstacleDespawnX: -140,
  recoveryItemDespawnX: -100,
  recoveryItemLowHeightAboveGround: 98,
  recoveryItemHighHeightAboveGround: 154,

  idleBackdropSpeed: 20,
  tutorialBackdropSpeed: 120,
  hudUpdateIntervalMs: 100,
  tutorialHeightAboveGround: 178,
  tutorialSuccessMessageX: 350,
  tutorialRisePixels: 16,
  tutorialDelayMs: 2_600,
  tutorialFadeDurationMs: 650,
  hitFeedbackDestroyDelayMs: 80,
  cameraShakeDurationMs: 120,
  cameraShakeIntensity: 0.006,
  feedbackDurationMs: 1_500,
  educationFeedbackDurationMs: 2_800,
  difficultyFeedbackDurationMs: 1_050,
  stageTransitionDurationMs: 1_800,
  finishGateSpawnOffsetPixels: 100,

  // v2 開始納入終點體力與受傷風險，不與舊制最高分混用。
  highScoreStorageKey: 'marathon-prep-runner.high-score.v2',
  leaderboardStorageKey: 'marathon-prep-runner.local-leaderboard',
  leaderboardMaxEntries: 10,
  leaderboardNameMaxLength: 12,
  leaderboardDefaultName: '匿名跑者',
  leaderboardIdMaxLength: 128,
} as const satisfies GameConfig;
