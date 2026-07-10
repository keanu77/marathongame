import type { MarathonStageId, ObstacleType, RecoveryItemType } from '../types';

export interface MarathonStageConfig {
  readonly id: MarathonStageId;
  readonly durationSeconds: number;
  readonly speedMultiplier: number;
  readonly energyDrainPerSecond: number;
  /** 大於 1 代表負向事件較疏，低於 1 代表較密集。 */
  readonly obstacleSpawnDelayMultiplier: number;
  /** 大於 1 代表恢復道具較疏，低於 1 代表較密集。 */
  readonly recoverySpawnDelayMultiplier: number;
  /** 套用於障礙造成的體力與風險數值，不影響碰撞判定。 */
  readonly obstacleDamageMultiplier: number;
  /** 套用於道具的體力／風險恢復，不改變狀態持續時間。 */
  readonly recoveryEffectMultiplier: number;
  readonly obstacleTypes: readonly ObstacleType[];
  readonly recoveryItemTypes: readonly RecoveryItemType[];
}

export interface MarathonConfig {
  readonly officialDistanceMeters: number;
  readonly finishGateLeadSeconds: number;
  readonly stages: readonly MarathonStageConfig[];
}

/**
 * 約 80 秒的三階段馬拉松活動。所有倍率都是遊戲平衡值，
 * 不代表個人化配速、訓練量或醫療風險評估。
 */
export const MARATHON_CONFIG = {
  officialDistanceMeters: 42_195,
  finishGateLeadSeconds: 1.6,
  stages: [
    {
      id: 'base',
      durationSeconds: 25,
      speedMultiplier: 0.96,
      energyDrainPerSecond: 0.35,
      obstacleSpawnDelayMultiplier: 1.4,
      recoverySpawnDelayMultiplier: 0.78,
      obstacleDamageMultiplier: 0.55,
      recoveryEffectMultiplier: 1.2,
      obstacleTypes: ['illness'],
      recoveryItemTypes: ['sleep', 'strength', 'nutrition', 'zone2'],
    },
    {
      id: 'build',
      durationSeconds: 30,
      speedMultiplier: 1,
      energyDrainPerSecond: 0.5,
      obstacleSpawnDelayMultiplier: 1.05,
      recoverySpawnDelayMultiplier: 0.92,
      obstacleDamageMultiplier: 0.85,
      recoveryEffectMultiplier: 1.05,
      obstacleTypes: ['illness', 'overtraining'],
      recoveryItemTypes: ['sleep', 'strength', 'nutrition', 'zone2', 'lsd', 'interval'],
    },
    {
      id: 'race',
      durationSeconds: 25,
      speedMultiplier: 1.05,
      energyDrainPerSecond: 0.7,
      obstacleSpawnDelayMultiplier: 0.98,
      recoverySpawnDelayMultiplier: 1,
      obstacleDamageMultiplier: 0.95,
      recoveryEffectMultiplier: 1,
      obstacleTypes: ['illness', 'sportsInjury', 'overtraining'],
      recoveryItemTypes: ['sleep', 'strength', 'nutrition', 'zone2', 'lsd', 'interval'],
    },
  ],
} as const satisfies MarathonConfig;
