import {
  GAME_CONFIG,
  MARATHON_CONFIG,
  type GameConfig,
  type MarathonConfig,
  type MarathonStageConfig,
} from '../config';
import type {
  GameStatusEffects,
  MarathonOutcome,
  MarathonRunState,
  MarathonStageId,
  MarathonStageSnapshot,
  ObstacleImpactResult,
  ObstacleType,
  RecoveryItemResult,
  RecoveryItemType,
  Vitals,
} from '../types';
import {
  advanceStatusEffects,
  applyObstacleImpact,
  applyRecoveryItem,
  clampVitals,
  createInitialStatusEffects,
  createInitialVitals,
  getEnergyDrainMultiplier,
  getPaceSpeedMultiplier,
  normalizeStatusEffects,
} from './vitalsSystem';

function normalizeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getStages(config: MarathonConfig): readonly MarathonStageConfig[] {
  if (config.stages.length === 0) {
    throw new Error('Marathon config requires at least one stage.');
  }
  return config.stages;
}

export function getMarathonTotalDurationSeconds(config: MarathonConfig = MARATHON_CONFIG): number {
  return getStages(config).reduce(
    (total, stage) => total + normalizeNonNegative(stage.durationSeconds),
    0,
  );
}

export function getMarathonStageConfig(
  stageId: MarathonStageId,
  config: MarathonConfig = MARATHON_CONFIG,
): MarathonStageConfig {
  const stage = getStages(config).find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`Unknown marathon stage: ${stageId}`);
  return stage;
}

/** 取得任意時間點的關卡、關內進度與全程進度。 */
export function getMarathonStageSnapshot(
  elapsedSeconds: number,
  config: MarathonConfig = MARATHON_CONFIG,
): MarathonStageSnapshot {
  const stages = getStages(config);
  const totalDurationSeconds = getMarathonTotalDurationSeconds(config);
  const safeElapsedSeconds = Math.min(totalDurationSeconds, normalizeNonNegative(elapsedSeconds));
  let stageStartSeconds = 0;

  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    if (!stage) continue;
    const stageDurationSeconds = normalizeNonNegative(stage.durationSeconds);
    const stageEndSeconds = stageStartSeconds + stageDurationSeconds;
    const isLastStage = index === stages.length - 1;

    if (safeElapsedSeconds < stageEndSeconds || isLastStage) {
      const isComplete = safeElapsedSeconds >= totalDurationSeconds;
      const stageElapsedSeconds = isComplete
        ? stageDurationSeconds
        : Math.min(stageDurationSeconds, Math.max(0, safeElapsedSeconds - stageStartSeconds));
      const nextStage = !isComplete && !isLastStage ? stages[index + 1] : undefined;

      return {
        stageId: stage.id,
        stageIndex: index,
        stageElapsedSeconds,
        stageRemainingSeconds: Math.max(0, stageDurationSeconds - stageElapsedSeconds),
        totalElapsedSeconds: safeElapsedSeconds,
        totalRemainingSeconds: Math.max(0, totalDurationSeconds - safeElapsedSeconds),
        overallProgress: totalDurationSeconds > 0 ? safeElapsedSeconds / totalDurationSeconds : 1,
        nextStageId: nextStage?.id ?? null,
        isComplete,
      };
    }

    stageStartSeconds = stageEndSeconds;
  }

  throw new Error('Unable to resolve marathon stage.');
}

export function getMarathonStageSpeedMultiplier(
  stageId: MarathonStageId,
  config: MarathonConfig = MARATHON_CONFIG,
): number {
  return getMarathonStageConfig(stageId, config).speedMultiplier;
}

export function getMarathonEffectiveSpeedMultiplier(
  stageId: MarathonStageId,
  statusEffects: GameStatusEffects,
  marathonConfig: MarathonConfig = MARATHON_CONFIG,
  gameConfig: GameConfig = GAME_CONFIG,
): number {
  return (
    getMarathonStageSpeedMultiplier(stageId, marathonConfig) *
    getPaceSpeedMultiplier(statusEffects, gameConfig)
  );
}

/** 套用目前關卡的傷害倍率；呼叫端只需提供 stageId，避免重複讀取設定。 */
export function applyMarathonObstacleImpact(
  vitals: Vitals,
  statusEffects: GameStatusEffects,
  obstacleType: ObstacleType,
  stageId: MarathonStageId,
  marathonConfig: MarathonConfig = MARATHON_CONFIG,
  gameConfig: GameConfig = GAME_CONFIG,
): ObstacleImpactResult {
  const stage = getMarathonStageConfig(stageId, marathonConfig);
  return applyObstacleImpact(
    vitals,
    statusEffects,
    obstacleType,
    gameConfig,
    stage.obstacleDamageMultiplier,
  );
}

/** 只縮放數值恢復；配速與防護等狀態時間維持原設定。 */
export function applyMarathonRecoveryItem(
  vitals: Vitals,
  statusEffects: GameStatusEffects,
  itemType: RecoveryItemType,
  stageId: MarathonStageId,
  marathonConfig: MarathonConfig = MARATHON_CONFIG,
  gameConfig: GameConfig = GAME_CONFIG,
): RecoveryItemResult {
  const stage = getMarathonStageConfig(stageId, marathonConfig);
  return applyRecoveryItem(
    vitals,
    statusEffects,
    itemType,
    gameConfig,
    stage.recoveryEffectMultiplier,
  );
}

export function determineMarathonOutcome(
  vitals: Vitals,
  elapsedSeconds: number,
  marathonConfig: MarathonConfig = MARATHON_CONFIG,
  gameConfig: GameConfig = GAME_CONFIG,
): MarathonOutcome {
  const normalizedVitals = clampVitals(vitals, gameConfig);

  if (normalizedVitals.energy <= gameConfig.minEnergy) {
    return { status: 'didNotFinish', reason: 'energyDepleted' };
  }
  if (normalizedVitals.injuryRisk >= gameConfig.maxInjuryRisk) {
    return { status: 'didNotFinish', reason: 'injuryRiskMaxed' };
  }
  if (normalizeNonNegative(elapsedSeconds) >= getMarathonTotalDurationSeconds(marathonConfig)) {
    return { status: 'finished', reason: 'completedAllStages' };
  }
  return { status: 'inProgress', reason: null };
}

export function createInitialMarathonRunState(
  marathonConfig: MarathonConfig = MARATHON_CONFIG,
  gameConfig: GameConfig = GAME_CONFIG,
): MarathonRunState {
  const vitals = createInitialVitals(gameConfig);
  return {
    elapsedSeconds: 0,
    vitals,
    statusEffects: createInitialStatusEffects(),
    stage: getMarathonStageSnapshot(0, marathonConfig),
    outcome: determineMarathonOutcome(vitals, 0, marathonConfig, gameConfig),
  };
}

/**
 * 依關卡耗能率、恢復不足與配速模式分段推進；跨越關卡或狀態到期時，
 * 只對實際重疊的秒數套用各自倍率。
 */
export function advanceMarathonRunState(
  state: MarathonRunState,
  deltaSeconds: number,
  marathonConfig: MarathonConfig = MARATHON_CONFIG,
  gameConfig: GameConfig = GAME_CONFIG,
): MarathonRunState {
  if (state.outcome.status !== 'inProgress') return state;

  let remainingSeconds = normalizeNonNegative(deltaSeconds);
  let elapsedSeconds = normalizeNonNegative(state.elapsedSeconds);
  let vitals = clampVitals(state.vitals, gameConfig);
  let statusEffects = normalizeStatusEffects(state.statusEffects);
  let outcome = determineMarathonOutcome(vitals, elapsedSeconds, marathonConfig, gameConfig);

  while (remainingSeconds > 0 && outcome.status === 'inProgress') {
    const stage = getMarathonStageSnapshot(elapsedSeconds, marathonConfig);
    if (stage.isComplete) break;

    const stageConfig = getMarathonStageConfig(stage.stageId, marathonConfig);
    const paceExpiresIn =
      statusEffects.paceMode === null
        ? Number.POSITIVE_INFINITY
        : statusEffects.paceRemainingSeconds;
    const recoveryDeficitExpiresIn =
      statusEffects.recoveryDeficitRemainingSeconds > 0
        ? statusEffects.recoveryDeficitRemainingSeconds
        : Number.POSITIVE_INFINITY;
    const drainRate =
      stageConfig.energyDrainPerSecond * getEnergyDrainMultiplier(statusEffects, gameConfig);
    const energyDepletesIn =
      drainRate > 0
        ? Math.max(0, (vitals.energy - gameConfig.minEnergy) / drainRate)
        : Number.POSITIVE_INFINITY;
    const stepSeconds = Math.min(
      remainingSeconds,
      stage.stageRemainingSeconds,
      paceExpiresIn,
      recoveryDeficitExpiresIn,
      energyDepletesIn,
    );

    if (stepSeconds <= 0) {
      outcome = determineMarathonOutcome(vitals, elapsedSeconds, marathonConfig, gameConfig);
      break;
    }

    vitals = clampVitals(
      { ...vitals, energy: vitals.energy - drainRate * stepSeconds },
      gameConfig,
    );
    statusEffects = advanceStatusEffects(
      vitals,
      statusEffects,
      stepSeconds,
      gameConfig,
    ).statusEffects;
    elapsedSeconds += stepSeconds;
    remainingSeconds -= stepSeconds;
    outcome = determineMarathonOutcome(vitals, elapsedSeconds, marathonConfig, gameConfig);
  }

  return {
    elapsedSeconds,
    vitals,
    statusEffects,
    stage: getMarathonStageSnapshot(elapsedSeconds, marathonConfig),
    outcome,
  };
}
