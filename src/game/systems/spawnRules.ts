import { MARATHON_CONFIG } from '../config';
import type { MarathonStageId, ObstacleType, RecoveryItemType } from '../types';

export interface SpawnDelayInput {
  speed: number;
  sampledDelayMs: number;
  minimumDelayMs: number;
  minimumGapPixels: number;
  delayMultiplier?: number;
}

export type StageSpawnPools<T> = Readonly<Record<MarathonStageId, readonly T[]>>;

export type StageSpawnPoolOverrides<T> = Partial<Readonly<Record<MarathonStageId, readonly T[]>>>;

function getConfiguredStage(stageId: MarathonStageId) {
  const stage = MARATHON_CONFIG.stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`Unknown marathon stage: ${stageId}`);
  return stage;
}

const baseStage = getConfiguredStage('base');
const buildStage = getConfiguredStage('build');
const raceStage = getConfiguredStage('race');

/** Default pools mirror the single source of truth in MARATHON_CONFIG. */
export const MARATHON_OBSTACLE_POOLS = {
  base: baseStage.obstacleTypes,
  build: buildStage.obstacleTypes,
  race: raceStage.obstacleTypes,
} as const satisfies StageSpawnPools<ObstacleType>;

/** Recovery tools unlock progressively as the training plan becomes specific. */
export const MARATHON_ITEM_POOLS = {
  base: baseStage.recoveryItemTypes,
  build: buildStage.recoveryItemTypes,
  race: raceStage.recoveryItemTypes,
} as const satisfies StageSpawnPools<RecoveryItemType>;

export function getObstacleSpawnPool(
  stageId: MarathonStageId,
  overrides?: StageSpawnPoolOverrides<ObstacleType>,
): readonly ObstacleType[] {
  return resolveStageSpawnPool(stageId, MARATHON_OBSTACLE_POOLS, overrides);
}

export function getItemSpawnPool(
  stageId: MarathonStageId,
  overrides?: StageSpawnPoolOverrides<RecoveryItemType>,
): readonly RecoveryItemType[] {
  return resolveStageSpawnPool(stageId, MARATHON_ITEM_POOLS, overrides);
}

/**
 * An explicitly supplied empty pool disables spawning for that stage. This is
 * useful for scripted transitions and keeps the policy out of the spawners.
 */
export function resolveStageSpawnPool<T>(
  stageId: MarathonStageId,
  defaults: StageSpawnPools<T>,
  overrides?: StageSpawnPoolOverrides<T>,
): readonly T[] {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, stageId)) {
    return overrides[stageId] ?? [];
  }

  return defaults[stageId];
}

export function calculateObstacleSpawnDelayMs({
  speed,
  sampledDelayMs,
  minimumDelayMs,
  minimumGapPixels,
  delayMultiplier = 1,
}: SpawnDelayInput): number {
  const safeSpeed = Number.isFinite(speed) ? Math.max(1, speed) : 1;
  const safeSampledDelay = applySpawnDelayMultiplier(sampledDelayMs, delayMultiplier);
  const safeMinimumDelay = applySpawnDelayMultiplier(minimumDelayMs, delayMultiplier);
  const safeMinimumGap = Number.isFinite(minimumGapPixels) ? Math.max(0, minimumGapPixels) : 0;

  return Math.max(safeMinimumDelay, safeSampledDelay, (safeMinimumGap / safeSpeed) * 1_000);
}

export function applySpawnDelayMultiplier(delayMs: number, multiplier: number): number {
  const safeDelayMs = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return safeDelayMs * safeMultiplier;
}

export function isSpawnLaneClear(
  occupantCenterXs: readonly number[],
  spawnX: number,
  clearancePixels: number,
): boolean {
  if (!Number.isFinite(spawnX) || !Number.isFinite(clearancePixels)) return false;
  const boundary = spawnX - Math.max(0, clearancePixels);

  return occupantCenterXs.every((positionX) => Number.isFinite(positionX) && positionX < boundary);
}
