import { GAME_CONFIG, type GameConfig } from '../config';
import { PACE_MODES } from '../types';
import type {
  GameStatusEffects,
  ObstacleImpactResult,
  ObstacleType,
  PaceMode,
  RecoveryItemResult,
  RecoveryItemType,
  StatusAdvanceResult,
  Vitals,
} from '../types';

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeRemainingSeconds(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

function normalizeEffectMultiplier(multiplier: number): number {
  return Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
}

function normalizePaceMode(mode: PaceMode | null): PaceMode | null {
  return mode !== null && PACE_MODES.includes(mode) ? mode : null;
}

export function createInitialVitals(config: GameConfig = GAME_CONFIG): Vitals {
  return {
    energy: config.initialEnergy,
    injuryRisk: config.initialInjuryRisk,
  };
}

export function createInitialStatusEffects(): GameStatusEffects {
  return {
    recoveryDeficitRemainingSeconds: 0,
    strengthProtectionRemainingSeconds: 0,
    paceMode: null,
    paceRemainingSeconds: 0,
  };
}

export function clampVitals(vitals: Vitals, config: GameConfig = GAME_CONFIG): Vitals {
  return {
    energy: clamp(vitals.energy, config.minEnergy, config.maxEnergy),
    injuryRisk: clamp(vitals.injuryRisk, config.minInjuryRisk, config.maxInjuryRisk),
  };
}

export function normalizeStatusEffects(statusEffects: GameStatusEffects): GameStatusEffects {
  const paceMode = normalizePaceMode(statusEffects.paceMode);
  const paceRemainingSeconds = normalizeRemainingSeconds(statusEffects.paceRemainingSeconds);

  return {
    recoveryDeficitRemainingSeconds: normalizeRemainingSeconds(
      statusEffects.recoveryDeficitRemainingSeconds,
    ),
    strengthProtectionRemainingSeconds: normalizeRemainingSeconds(
      statusEffects.strengthProtectionRemainingSeconds,
    ),
    paceMode: paceMode !== null && paceRemainingSeconds > 0 ? paceMode : null,
    paceRemainingSeconds: paceMode !== null ? paceRemainingSeconds : 0,
  };
}

/** 配速模式只影響遊戲速度，不代表真實建議配速。 */
export function getPaceSpeedMultiplier(
  statusEffects: GameStatusEffects,
  config: GameConfig = GAME_CONFIG,
): number {
  const normalized = normalizeStatusEffects(statusEffects);
  return normalized.paceMode === null ? 1 : config.paceModes[normalized.paceMode].speedMultiplier;
}

/**
 * 合併配速模式與恢復不足的耗能倍率。間歇較快但成本較高；
 * Zone 2 與 LSD 較省能，避免將高強度呈現成永遠較好。
 */
export function getEnergyDrainMultiplier(
  statusEffects: GameStatusEffects,
  config: GameConfig = GAME_CONFIG,
): number {
  const normalized = normalizeStatusEffects(statusEffects);
  const paceMultiplier =
    normalized.paceMode === null ? 1 : config.paceModes[normalized.paceMode].energyDrainMultiplier;
  const recoveryDeficitMultiplier =
    normalized.recoveryDeficitRemainingSeconds > 0
      ? config.recoveryDeficitEnergyDrainMultiplier
      : 1;
  return paceMultiplier * recoveryDeficitMultiplier;
}

export function applyPassiveEnergyDrain(
  vitals: Vitals,
  deltaSeconds: number,
  statusEffects: GameStatusEffects = createInitialStatusEffects(),
  config: GameConfig = GAME_CONFIG,
): Vitals {
  const safeDeltaSeconds = normalizeRemainingSeconds(deltaSeconds);

  return clampVitals(
    {
      ...vitals,
      energy:
        vitals.energy -
        config.passiveEnergyDrainPerSecond *
          getEnergyDrainMultiplier(statusEffects, config) *
          safeDeltaSeconds,
    },
    config,
  );
}

function getObstacleDamageMultiplier(statusEffects: GameStatusEffects, config: GameConfig): number {
  return statusEffects.strengthProtectionRemainingSeconds > 0
    ? config.strengthProtectionDamageMultiplier
    : 1;
}

/** 處理單次、遊戲化的馬拉松障礙效果。 */
export function applyObstacleImpact(
  vitals: Vitals,
  statusEffects: GameStatusEffects,
  obstacleType: ObstacleType,
  config: GameConfig = GAME_CONFIG,
  stageDamageMultiplier = 1,
): ObstacleImpactResult {
  const normalizedVitals = clampVitals(vitals, config);
  const nextStatusEffects = normalizeStatusEffects(statusEffects);
  const multiplier =
    getObstacleDamageMultiplier(nextStatusEffects, config) *
    normalizeEffectMultiplier(stageDamageMultiplier);
  let energyDamage = 0;
  let injuryRiskDamage = 0;

  switch (obstacleType) {
    case 'illness':
      energyDamage = config.illnessEnergyDamage * multiplier;
      injuryRiskDamage = config.illnessRiskDamage * multiplier;
      nextStatusEffects.recoveryDeficitRemainingSeconds = Math.max(
        nextStatusEffects.recoveryDeficitRemainingSeconds,
        config.illnessRecoveryDeficitSeconds,
      );
      break;
    case 'sportsInjury':
      energyDamage = config.sportsInjuryEnergyDamage * multiplier;
      injuryRiskDamage = config.sportsInjuryRiskDamage * multiplier;
      break;
    case 'overtraining':
      energyDamage = config.overtrainingEnergyDamage * multiplier;
      injuryRiskDamage = config.overtrainingRiskDamage * multiplier;
      nextStatusEffects.recoveryDeficitRemainingSeconds = Math.max(
        nextStatusEffects.recoveryDeficitRemainingSeconds,
        config.overtrainingRecoveryDeficitSeconds,
      );
      break;
  }

  const nextVitals = clampVitals(
    {
      energy: normalizedVitals.energy - energyDamage,
      injuryRisk: normalizedVitals.injuryRisk + injuryRiskDamage,
    },
    config,
  );

  return {
    vitals: nextVitals,
    statusEffects: nextStatusEffects,
    energyDamage: normalizedVitals.energy - nextVitals.energy,
    injuryRiskDamage: nextVitals.injuryRisk - normalizedVitals.injuryRisk,
  };
}

function activatePaceMode(
  statusEffects: GameStatusEffects,
  mode: PaceMode,
  config: GameConfig,
): void {
  statusEffects.paceMode = mode;
  statusEffects.paceRemainingSeconds = config.paceModes[mode].durationSeconds;
}

/**
 * 後取得的配速道具會覆蓋先前模式。恢復不足只降低數值恢復，
 * 不縮短配速模式或肌力防護的持續時間。
 */
export function applyRecoveryItem(
  vitals: Vitals,
  statusEffects: GameStatusEffects,
  itemType: RecoveryItemType,
  config: GameConfig = GAME_CONFIG,
  stageRecoveryMultiplier = 1,
): RecoveryItemResult {
  const normalizedVitals = clampVitals(vitals, config);
  const nextStatusEffects = normalizeStatusEffects(statusEffects);
  const recoveryMultiplier =
    nextStatusEffects.recoveryDeficitRemainingSeconds > 0
      ? config.recoveryDeficitRecoveryMultiplier *
        normalizeEffectMultiplier(stageRecoveryMultiplier)
      : normalizeEffectMultiplier(stageRecoveryMultiplier);
  let nextVitals = normalizedVitals;
  let paceModeActivated: PaceMode | null = null;

  switch (itemType) {
    case 'sleep':
      nextVitals = clampVitals(
        {
          energy: normalizedVitals.energy + config.sleepEnergyRecovery * recoveryMultiplier,
          injuryRisk: normalizedVitals.injuryRisk - config.sleepRiskReduction * recoveryMultiplier,
        },
        config,
      );
      nextStatusEffects.recoveryDeficitRemainingSeconds = 0;
      break;
    case 'strength':
      nextStatusEffects.strengthProtectionRemainingSeconds = Math.max(
        nextStatusEffects.strengthProtectionRemainingSeconds,
        config.strengthProtectionSeconds,
      );
      break;
    case 'nutrition':
      nextVitals = clampVitals(
        {
          ...normalizedVitals,
          energy: normalizedVitals.energy + config.nutritionEnergyRecovery * recoveryMultiplier,
        },
        config,
      );
      break;
    case 'zone2':
    case 'lsd':
    case 'interval': {
      paceModeActivated = itemType;
      activatePaceMode(nextStatusEffects, itemType, config);
      const immediateEnergyRecovery =
        config.paceModes[itemType].immediateEnergyRecovery * recoveryMultiplier;
      nextVitals = clampVitals(
        { ...normalizedVitals, energy: normalizedVitals.energy + immediateEnergyRecovery },
        config,
      );
      break;
    }
  }

  return {
    vitals: nextVitals,
    statusEffects: nextStatusEffects,
    energyRecovered: nextVitals.energy - normalizedVitals.energy,
    injuryRiskReduced: normalizedVitals.injuryRisk - nextVitals.injuryRisk,
    paceModeActivated,
  };
}

export function advanceStatusEffects(
  vitals: Vitals,
  statusEffects: GameStatusEffects,
  deltaSeconds: number,
  config: GameConfig = GAME_CONFIG,
): StatusAdvanceResult {
  const normalizedVitals = clampVitals(vitals, config);
  const normalizedStatusEffects = normalizeStatusEffects(statusEffects);
  const safeDeltaSeconds = normalizeRemainingSeconds(deltaSeconds);
  const nextRecoveryDeficitSeconds = Math.max(
    0,
    normalizedStatusEffects.recoveryDeficitRemainingSeconds - safeDeltaSeconds,
  );
  const nextPaceSeconds = Math.max(
    0,
    normalizedStatusEffects.paceRemainingSeconds - safeDeltaSeconds,
  );
  const paceModeExpired =
    normalizedStatusEffects.paceMode !== null &&
    normalizedStatusEffects.paceRemainingSeconds > 0 &&
    nextPaceSeconds === 0;

  return {
    vitals: normalizedVitals,
    statusEffects: {
      recoveryDeficitRemainingSeconds: nextRecoveryDeficitSeconds,
      strengthProtectionRemainingSeconds: Math.max(
        0,
        normalizedStatusEffects.strengthProtectionRemainingSeconds - safeDeltaSeconds,
      ),
      paceMode: nextPaceSeconds > 0 ? normalizedStatusEffects.paceMode : null,
      paceRemainingSeconds: nextPaceSeconds,
    },
    paceModeExpired,
    recoveryDeficitExpired:
      normalizedStatusEffects.recoveryDeficitRemainingSeconds > 0 &&
      nextRecoveryDeficitSeconds === 0,
  };
}
