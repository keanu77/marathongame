import type { PaceMode, RecoveryItemType } from '../types';

export interface PaceModeConfig {
  readonly durationSeconds: number;
  readonly speedMultiplier: number;
  readonly energyDrainMultiplier: number;
  readonly immediateEnergyRecovery: number;
}

export interface GameConfig {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly groundY: number;
  readonly playerStartX: number;
  readonly playerWidth: number;
  readonly playerHeight: number;
  readonly gravityY: number;
  readonly jumpVelocity: number;
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
  readonly maximumConcurrentObstacles: number;
  readonly obstacleDespawnX: number;
  readonly recoveryItemDespawnX: number;
  readonly recoveryItemLowHeightAboveGround: number;
  readonly recoveryItemHighHeightAboveGround: number;
  readonly idleBackdropSpeed: number;
  readonly tutorialBackdropSpeed: number;
  readonly hudUpdateIntervalMs: number;
  readonly tutorialHeightAboveGround: number;
  readonly tutorialRisePixels: number;
  readonly tutorialDelayMs: number;
  readonly tutorialFadeDurationMs: number;
  readonly hitFeedbackDestroyDelayMs: number;
  readonly cameraShakeDurationMs: number;
  readonly cameraShakeIntensity: number;
  readonly feedbackFloatDistance: number;
  readonly feedbackDurationMs: number;
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

/**
 * 所有可調整的遊戲數值都集中在此，場景與系統不應重複寫死數值。
 */
export const GAME_CONFIG = {
  canvasWidth: 540,
  canvasHeight: 960,
  groundY: 800,
  playerStartX: 108,
  playerWidth: 58,
  playerHeight: 86,
  gravityY: 1_800,
  jumpVelocity: -720,
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
    },
    lsd: {
      durationSeconds: 9,
      speedMultiplier: 0.98,
      energyDrainMultiplier: 0.58,
      immediateEnergyRecovery: 8,
    },
    interval: {
      durationSeconds: 5,
      speedMultiplier: 1.18,
      energyDrainMultiplier: 1.3,
      immediateEnergyRecovery: 0,
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
  maximumConcurrentObstacles: 2,
  obstacleDespawnX: -140,
  recoveryItemDespawnX: -100,
  recoveryItemLowHeightAboveGround: 98,
  recoveryItemHighHeightAboveGround: 154,

  idleBackdropSpeed: 20,
  tutorialBackdropSpeed: 120,
  hudUpdateIntervalMs: 100,
  tutorialHeightAboveGround: 178,
  tutorialRisePixels: 16,
  tutorialDelayMs: 2_600,
  tutorialFadeDurationMs: 650,
  hitFeedbackDestroyDelayMs: 80,
  cameraShakeDurationMs: 120,
  cameraShakeIntensity: 0.006,
  feedbackFloatDistance: 42,
  feedbackDurationMs: 780,
  difficultyFeedbackDurationMs: 1_050,
  stageTransitionDurationMs: 1_800,
  finishGateSpawnOffsetPixels: 100,

  highScoreStorageKey: 'marathon-prep-runner.high-score',
  leaderboardStorageKey: 'marathon-prep-runner.local-leaderboard',
  leaderboardMaxEntries: 10,
  leaderboardNameMaxLength: 12,
  leaderboardDefaultName: '匿名跑者',
  leaderboardIdMaxLength: 128,
} as const satisfies GameConfig;
