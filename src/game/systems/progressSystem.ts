import { GAME_CONFIG, type GameConfig } from '../config';
import type { GameProgress } from '../types';

function normalizeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeSpeedMultiplier(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 1;
}

export function getDifficultyLevel(
  elapsedSeconds: number,
  config: GameConfig = GAME_CONFIG,
): number {
  const safeElapsedSeconds = normalizeNonNegative(elapsedSeconds);
  return Math.min(
    config.maximumDifficultyLevel,
    Math.floor(safeElapsedSeconds / config.speedIncreaseEverySeconds) + 1,
  );
}

/** 每個難度區間以複利增加 5% 速度。 */
export function getSpeedForElapsedSeconds(
  elapsedSeconds: number,
  config: GameConfig = GAME_CONFIG,
): number {
  const completedIncreases = getDifficultyLevel(elapsedSeconds, config) - 1;
  return Math.min(
    config.maximumSpeed,
    config.initialSpeed * Math.pow(1 + config.speedIncreaseRate, completedIncreases),
  );
}

export function calculateScore(
  distanceMeters: number,
  collectedRecoveryItems: number,
  config: GameConfig = GAME_CONFIG,
): number {
  const distanceScore = normalizeNonNegative(distanceMeters) * config.scorePerMeter;
  const itemScore =
    Math.floor(normalizeNonNegative(collectedRecoveryItems)) * config.recoveryItemScoreBonus;
  return Math.max(0, Math.floor(distanceScore + itemScore));
}

export function createInitialProgress(config: GameConfig = GAME_CONFIG): GameProgress {
  return {
    elapsedSeconds: 0,
    distanceMeters: 0,
    score: 0,
    speed: config.initialSpeed,
    difficultyLevel: 1,
    collectedRecoveryItems: 0,
  };
}

/**
 * 用分段積分處理剛好跨過加速時點的 frame，避免 delta 較大時
 * 距離誤差。
 */
function calculateTravelPixels(
  fromElapsedSeconds: number,
  toElapsedSeconds: number,
  config: GameConfig,
  speedMultiplier: number,
): number {
  let cursor = fromElapsedSeconds;
  let travelPixels = 0;

  while (cursor < toElapsedSeconds) {
    const completedIncreases = Math.floor(cursor / config.speedIncreaseEverySeconds);
    const nextIncreaseAt = (completedIncreases + 1) * config.speedIncreaseEverySeconds;
    const segmentEnd = Math.min(toElapsedSeconds, nextIncreaseAt);
    const speed = getSpeedForElapsedSeconds(cursor, config);
    travelPixels += speed * speedMultiplier * (segmentEnd - cursor);
    cursor = segmentEnd;
  }

  return travelPixels;
}

export function advanceProgress(
  progress: GameProgress,
  deltaSeconds: number,
  collectedRecoveryItems = 0,
  config: GameConfig = GAME_CONFIG,
  speedMultiplier = 1,
): GameProgress {
  const safeDeltaSeconds = normalizeNonNegative(deltaSeconds);
  const currentElapsedSeconds = normalizeNonNegative(progress.elapsedSeconds);
  const nextElapsedSeconds = currentElapsedSeconds + safeDeltaSeconds;
  const normalizedSpeedMultiplier = normalizeSpeedMultiplier(speedMultiplier);
  const travelPixels = calculateTravelPixels(
    currentElapsedSeconds,
    nextElapsedSeconds,
    config,
    normalizedSpeedMultiplier,
  );
  const nextDistanceMeters =
    normalizeNonNegative(progress.distanceMeters) + travelPixels * config.metersPerPixel;
  const nextCollectedRecoveryItems =
    Math.floor(normalizeNonNegative(progress.collectedRecoveryItems)) +
    Math.floor(normalizeNonNegative(collectedRecoveryItems));

  return {
    elapsedSeconds: nextElapsedSeconds,
    distanceMeters: nextDistanceMeters,
    score: calculateScore(nextDistanceMeters, nextCollectedRecoveryItems, config),
    speed: getSpeedForElapsedSeconds(nextElapsedSeconds, config) * normalizedSpeedMultiplier,
    difficultyLevel: getDifficultyLevel(nextElapsedSeconds, config),
    collectedRecoveryItems: nextCollectedRecoveryItems,
  };
}
